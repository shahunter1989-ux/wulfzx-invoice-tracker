"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { InvoiceStatus } from "../lib/types";
import { calculateLineTotal, calculateSubtotal, calculateInvoiceTotal } from "../lib/calculations";
import { ensureUserDefaults, updateInvoiceStatus } from "../lib/data";
import { toMoney, toText } from "../lib/format";
import { getUserIfConfigured } from "../lib/auth";
import { createClient } from "../lib/supabase/server";
import { createAdminClient } from "../lib/supabase/admin";
import { cleanEnvValue } from "../lib/supabase/config";
import { logAuditEvent } from "../lib/audit";
import { requireOwner, requireWorkspace, type WorkspaceContext, type WorkspaceRole } from "../lib/workspace";

export async function signInAction(formData: FormData) {
  const email = toText(formData.get("email"));
  const password = toText(formData.get("password"));
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user) {
    const { data: member } = await supabase.from("workspace_members").select("role").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    if (member && member.role !== "owner") {
      redirect("/submit");
    }
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  const { supabase } = await getUserIfConfigured();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/login");
}

export async function createCustomerAction(formData: FormData) {
  const { supabase, user, workspace } = await requireOwner();
  await ensureUserDefaults(supabase, user, workspace.id);

  const name = toText(formData.get("name"));
  if (!name) {
    redirect("/customers/new?error=Customer%20name%20is%20required");
  }

  const { error } = await supabase.from("customers").insert({
    user_id: user.id,
    workspace_id: workspace.id,
    name,
    contact_name: toText(formData.get("contact_name")) || null,
    email: toText(formData.get("email")) || null,
    phone: toText(formData.get("phone")) || null,
    address: toText(formData.get("address")) || null,
    notes: toText(formData.get("notes")) || null
  });

  if (error) {
    redirect(`/customers/new?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "create", entityType: "customer", metadata: { name } });
  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomerAction(formData: FormData) {
  const { supabase, user, workspace } = await requireOwner();
  const customerId = toText(formData.get("customer_id"));
  const name = toText(formData.get("name"));

  if (!customerId) {
    redirect("/customers?error=Customer%20record%20is%20required");
  }

  if (!name) {
    redirect(`/customers/${customerId}/edit?error=Customer%20name%20is%20required`);
  }

  const { error } = await supabase
    .from("customers")
    .update({
      name,
      contact_name: toText(formData.get("contact_name")) || null,
      email: toText(formData.get("email")) || null,
      phone: toText(formData.get("phone")) || null,
      address: toText(formData.get("address")) || null,
      notes: toText(formData.get("notes")) || null
    })
    .eq("id", customerId)
    .eq("workspace_id", workspace.id);

  if (error) {
    redirect(`/customers/${customerId}/edit?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "update", entityType: "customer", entityId: customerId });
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}/edit`);
  redirect("/customers?saved=1");
}

export async function deleteCustomerAction(formData: FormData) {
  const { supabase, user, workspace } = await requireOwner();
  const customerId = toText(formData.get("customer_id"));

  if (!customerId) {
    redirect("/customers?error=Customer%20record%20is%20required");
  }

  const { count, error: countError } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .eq("workspace_id", workspace.id);

  if (countError) {
    redirect(`/customers?error=${encodeURIComponent(countError.message)}`);
  }

  if ((count ?? 0) > 0) {
    redirect("/customers?error=Customers%20with%20invoices%20cannot%20be%20deleted");
  }

  const { error } = await supabase.from("customers").delete().eq("id", customerId).eq("workspace_id", workspace.id);

  if (error) {
    redirect(`/customers?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "delete", entityType: "customer", entityId: customerId });
  revalidatePath("/customers");
  redirect("/customers?deleted=1");
}

export async function createInvoiceAction(formData: FormData) {
  const { supabase, user, workspace } = await requireOwner();
  await ensureUserDefaults(supabase, user, workspace.id);

  const customerId = toText(formData.get("customer_id"));
  const issueDate = toText(formData.get("issue_date")) || new Date().toISOString().slice(0, 10);
  const dueDate = toText(formData.get("due_date")) || null;
  const descriptions = formData.getAll("description").map((entry) => toText(entry));
  const quantities = formData.getAll("quantity").map((entry) => toMoney(entry));
  const unitPrices = formData.getAll("unit_price").map((entry) => toMoney(entry));

  const items = descriptions
    .map((description, index) => ({
      description,
      quantity: quantities[index] || 0,
      unitPrice: unitPrices[index] || 0
    }))
    .filter((item) => item.description && item.quantity > 0);

  if (!customerId || items.length === 0) {
    redirect("/invoices/new?error=Customer%20and%20at%20least%20one%20line%20item%20are%20required");
  }

  const { data: settings } = await supabase.from("company_settings").select("invoice_prefix").eq("workspace_id", workspace.id).maybeSingle();
  const prefix = settings?.invoice_prefix || "WZX";
  const year = new Date(`${issueDate}T00:00:00`).getFullYear();
  const { data: invoiceNumber, error: numberError } = await supabase.rpc("next_workspace_invoice_number", {
    p_workspace_id: workspace.id,
    p_prefix: prefix,
    p_year: year
  });

  if (numberError || !invoiceNumber) {
    redirect(`/invoices/new?error=${encodeURIComponent(numberError?.message || "Could not generate invoice number")}`);
  }

  const subtotal = calculateSubtotal(items);
  const discountAmount = toMoney(formData.get("discount_amount"));
  const taxAmount = toMoney(formData.get("tax_amount"));
  const shippingAmount = toMoney(formData.get("shipping_amount"));
  const depositAmount = toMoney(formData.get("deposit_amount"));
  const totalAmount = calculateInvoiceTotal(subtotal, discountAmount, taxAmount, shippingAmount);

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      workspace_id: workspace.id,
      customer_id: customerId,
      invoice_number: invoiceNumber,
      status: "draft" satisfies InvoiceStatus,
      issue_date: issueDate,
      due_date: dueDate,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      shipping_amount: shippingAmount,
      deposit_amount: depositAmount,
      total_amount: totalAmount,
      ship_to_name: toText(formData.get("ship_to_name")) || null,
      ship_to_address: toText(formData.get("ship_to_address")) || null,
      ship_to_contact: toText(formData.get("ship_to_contact")) || null,
      payment_terms: toText(formData.get("payment_terms")) || null,
      notes: toText(formData.get("notes")) || null,
      terms: toText(formData.get("terms")) || null
    })
    .select("id")
    .single();

  if (invoiceError || !invoice) {
    redirect(`/invoices/new?error=${encodeURIComponent(invoiceError?.message || "Could not save invoice")}`);
  }

  const { error: itemsError } = await supabase.from("invoice_items").insert(
    items.map((item) => ({
      user_id: user.id,
      workspace_id: workspace.id,
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: calculateLineTotal(item.quantity, item.unitPrice)
    }))
  );

  if (itemsError) {
    redirect(`/invoices/${invoice.id}?error=${encodeURIComponent(itemsError.message)}`);
  }

  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "create", entityType: "invoice", entityId: invoice.id, metadata: { invoiceNumber } });
  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function deleteInvoiceAction(formData: FormData) {
  const { supabase, user, workspace } = await requireOwner();
  const invoiceId = toText(formData.get("invoice_id"));
  const returnTo = toText(formData.get("return_to"));
  const safeReturnTo = ["/invoices", "/reports"].includes(returnTo) ? returnTo : "/invoices";

  if (!invoiceId) {
    redirect(`${safeReturnTo}?error=Invoice%20record%20is%20required`);
  }

  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId).eq("workspace_id", workspace.id);

  if (error) {
    if (returnTo) {
      redirect(`${safeReturnTo}?error=${encodeURIComponent(error.message)}`);
    }
    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "delete", entityType: "invoice", entityId: invoiceId });
  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath("/payments");
  revalidatePath("/reports");
  redirect(`${safeReturnTo}?deleted=1`);
}

export async function markInvoiceStatusAction(formData: FormData) {
  const { supabase, user, workspace } = await requireOwner();
  const invoiceId = toText(formData.get("invoice_id"));
  const status = toText(formData.get("status")) as InvoiceStatus;

  if (!invoiceId || !["draft", "sent", "cancelled"].includes(status)) {
    redirect("/invoices");
  }

  await supabase.from("invoices").update({ status }).eq("id", invoiceId).eq("workspace_id", workspace.id);
  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "status", entityType: "invoice", entityId: invoiceId, metadata: { status } });
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}`);
}

export async function recordPaymentAction(formData: FormData) {
  const { supabase, user, workspace } = await requireOwner();
  const invoiceId = toText(formData.get("invoice_id"));
  const amount = toMoney(formData.get("amount"));

  if (!invoiceId || amount <= 0) {
    redirect("/payments?error=Invoice%20and%20payment%20amount%20are%20required");
  }

  const { error } = await supabase.from("payments").insert({
    user_id: user.id,
    workspace_id: workspace.id,
    invoice_id: invoiceId,
    payment_date: toText(formData.get("payment_date")) || new Date().toISOString().slice(0, 10),
    amount,
    payment_method: toText(formData.get("payment_method")) || "other",
    reference_number: toText(formData.get("reference_number")) || null,
    notes: toText(formData.get("notes")) || null
  });

  if (error) {
    redirect(`/payments?error=${encodeURIComponent(error.message)}`);
  }

  const { data: invoice } = await supabase.from("invoices").select("id,status,total_amount,deposit_amount,due_date").eq("id", invoiceId).eq("workspace_id", workspace.id).single();
  if (invoice) {
    await updateInvoiceStatus(supabase, invoice);
  }

  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "create", entityType: "payment", metadata: { invoiceId, amount } });
  revalidatePath("/dashboard");
  revalidatePath("/payments");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}`);
}

export async function createExpenseAction(formData: FormData) {
  const { supabase, user, workspace } = await requireOwner();
  await ensureUserDefaults(supabase, user, workspace.id);

  const amount = toMoney(formData.get("amount"));
  if (amount <= 0) {
    redirect("/receipts?error=Amount%20is%20required");
  }

  const { error } = await supabase.from("expenses").insert({
    user_id: user.id,
    workspace_id: workspace.id,
    category_id: toText(formData.get("category_id")) || null,
    vendor: toText(formData.get("vendor")) || null,
    expense_date: toText(formData.get("expense_date")) || new Date().toISOString().slice(0, 10),
    amount,
    payment_method: toText(formData.get("payment_method")) || "other",
    receipt_url: toText(formData.get("receipt_url")) || null,
    notes: toText(formData.get("notes")) || null
  });

  if (error) {
    redirect(`/receipts?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "create", entityType: "expense", metadata: { amount } });
  revalidatePath("/dashboard");
  revalidatePath("/receipts");
  revalidatePath("/reports");
  redirect("/receipts");
}

export async function updateExpenseAction(formData: FormData) {
  const { supabase, user, workspace } = await requireOwner();
  await ensureUserDefaults(supabase, user, workspace.id);

  const expenseId = toText(formData.get("expense_id"));
  const amount = toMoney(formData.get("amount"));

  if (!expenseId) {
    redirect("/receipts?error=Expense%20record%20is%20required");
  }

  if (amount <= 0) {
    redirect(`/receipts/${expenseId}/edit?error=Amount%20is%20required`);
  }

  const { error } = await supabase
    .from("expenses")
    .update({
      user_id: user.id,
      workspace_id: workspace.id,
      category_id: toText(formData.get("category_id")) || null,
      vendor: toText(formData.get("vendor")) || null,
      expense_date: toText(formData.get("expense_date")) || new Date().toISOString().slice(0, 10),
      amount,
      payment_method: toText(formData.get("payment_method")) || "other",
      receipt_url: toText(formData.get("receipt_url")) || null,
      notes: toText(formData.get("notes")) || null
    })
    .eq("id", expenseId)
    .eq("workspace_id", workspace.id);

  if (error) {
    redirect(`/receipts/${expenseId}/edit?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "update", entityType: "expense", entityId: expenseId });
  revalidatePath("/dashboard");
  revalidatePath("/receipts");
  revalidatePath(`/receipts/${expenseId}/edit`);
  revalidatePath("/reports");
  redirect("/receipts?saved=1");
}

export async function deleteExpenseAction(formData: FormData) {
  const { supabase, user, workspace } = await requireOwner();
  const expenseId = toText(formData.get("expense_id"));

  if (!expenseId) {
    redirect("/receipts?error=Expense%20record%20is%20required");
  }

  const { error } = await supabase.from("expenses").delete().eq("id", expenseId).eq("workspace_id", workspace.id);

  if (error) {
    redirect(`/receipts?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "delete", entityType: "expense", entityId: expenseId });
  revalidatePath("/dashboard");
  revalidatePath("/receipts");
  revalidatePath("/reports");
  redirect("/receipts?deleted=1");
}

export async function updateSettingsAction(formData: FormData) {
  const { supabase, user, workspace } = await requireOwner();
  const { error } = await supabase.from("company_settings").upsert(
    {
      user_id: user.id,
      workspace_id: workspace.id,
      company_name: toText(formData.get("company_name")) || "Wulfzx.underground",
      company_email: toText(formData.get("company_email")) || null,
      company_phone: toText(formData.get("company_phone")) || null,
      company_address: toText(formData.get("company_address")) || null,
      default_currency: toText(formData.get("default_currency")) || "USD",
      default_tax_rate: toMoney(formData.get("default_tax_rate")),
      invoice_prefix: toText(formData.get("invoice_prefix")) || "WZX",
      invoice_template: toText(formData.get("invoice_template")) || "wulfzx_blueprint"
    },
    { onConflict: "workspace_id" }
  );

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "update", entityType: "settings" });
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

export async function submitCustomerSubmissionAction(formData: FormData) {
  await createSubmissionAction("customer", formData);
}

export async function submitInvoiceSubmissionAction(formData: FormData) {
  await createSubmissionAction("invoice", formData);
}

export async function submitPaymentSubmissionAction(formData: FormData) {
  await createSubmissionAction("payment", formData);
}

export async function submitExpenseSubmissionAction(formData: FormData) {
  await createSubmissionAction("expense", formData);
}

export async function reviewSubmissionAction(formData: FormData) {
  const { supabase, user, workspace } = await requireOwner();
  const submissionId = toText(formData.get("submission_id"));
  const decision = toText(formData.get("decision"));
  const reviewNote = toText(formData.get("review_note")) || null;

  if (!submissionId || !["approved", "rejected", "needs_correction"].includes(decision)) {
    redirect("/approvals?error=Review%20decision%20is%20required");
  }

  const { data: submission, error: fetchError } = await supabase
    .from("submission_queue")
    .select("id,submission_type,payload,status")
    .eq("id", submissionId)
    .eq("workspace_id", workspace.id)
    .single();

  if (fetchError || !submission) {
    redirect(`/approvals?error=${encodeURIComponent(fetchError?.message || "Submission not found")}`);
  }

  if (submission.status !== "pending") {
    redirect("/approvals?error=Only%20pending%20submissions%20can%20be%20reviewed");
  }

  let officialRecordId: string | null = null;
  if (decision === "approved") {
    try {
      officialRecordId = await approveSubmissionPayload({ supabase, user, workspace, type: submission.submission_type, payload: submission.payload as SubmissionPayload });
    } catch (error) {
      redirect(`/approvals?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not approve submission")}`);
    }
  }

  const { error } = await supabase
    .from("submission_queue")
    .update({
      status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote
    })
    .eq("id", submissionId)
    .eq("workspace_id", workspace.id);

  if (error) {
    redirect(`/approvals?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent(supabase, {
    workspaceId: workspace.id,
    actorId: user.id,
    action: decision,
    entityType: "submission",
    entityId: submissionId,
    metadata: { submissionType: submission.submission_type, officialRecordId, reviewNote }
  });

  revalidatePath("/approvals");
  revalidatePath("/activity");
  revalidatePath("/dashboard");
  revalidatePath("/customers");
  revalidatePath("/invoices");
  revalidatePath("/payments");
  revalidatePath("/receipts");
  revalidatePath("/reports");
  redirect(`/approvals?reviewed=${decision}`);
}

export async function inviteTeamMemberAction(formData: FormData) {
  const { supabase, user, workspace } = await requireOwner();
  const email = toText(formData.get("email")).toLowerCase();
  const role = toText(formData.get("role")) as WorkspaceRole;

  if (!email || !["employee", "intern"].includes(role)) {
    redirect("/team?error=Email%20and%20role%20are%20required");
  }

  let invitedUserId: string | null = null;
  try {
    const admin = createAdminClient();
    const appUrl = cleanEnvValue(process.env.NEXT_PUBLIC_APP_URL) || "https://wulfzx-invoice-tracker.vercel.app";
    const redirectTo = `${appUrl.replace(/\/$/, "")}/auth/callback?next=/submit`;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { workspace_id: workspace.id, role }
    });
    if (error) throw error;
    invitedUserId = data.user?.id ?? null;
  } catch (error) {
    redirect(`/team?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not send invite")}`);
  }

  const { data: invite, error: inviteError } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspace.id,
      email,
      role,
      status: "sent",
      invited_by: user.id,
      invited_user_id: invitedUserId
    })
    .select("id")
    .single();

  if (inviteError) {
    redirect(`/team?error=${encodeURIComponent(inviteError.message)}`);
  }

  if (invitedUserId) {
    const { error: memberError } = await supabase.from("workspace_members").upsert(
      {
        workspace_id: workspace.id,
        user_id: invitedUserId,
        role,
        status: "active"
      },
      { onConflict: "workspace_id,user_id" }
    );
    if (memberError) {
      redirect(`/team?error=${encodeURIComponent(memberError.message)}`);
    }
  }

  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "invite", entityType: "member", entityId: invite?.id, metadata: { email, role } });
  revalidatePath("/team");
  revalidatePath("/activity");
  redirect("/team?invited=1");
}

export async function updateTeamMemberRoleAction(formData: FormData) {
  const { supabase, user, workspace } = await requireOwner();
  const memberUserId = toText(formData.get("member_user_id"));
  const role = toText(formData.get("role")) as WorkspaceRole;

  if (!memberUserId || !["employee", "intern"].includes(role)) {
    redirect("/team?error=Member%20and%20role%20are%20required");
  }

  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspace.id)
    .eq("user_id", memberUserId)
    .neq("role", "owner");

  if (error) {
    redirect(`/team?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "role_update", entityType: "member", metadata: { memberUserId, role } });
  revalidatePath("/team");
  revalidatePath("/activity");
  redirect("/team?saved=1");
}

export async function removeTeamMemberAction(formData: FormData) {
  const { supabase, user, workspace } = await requireOwner();
  const memberUserId = toText(formData.get("member_user_id"));

  if (!memberUserId || memberUserId === user.id) {
    redirect("/team?error=Member%20record%20is%20required");
  }

  const { error } = await supabase
    .from("workspace_members")
    .update({ status: "removed" })
    .eq("workspace_id", workspace.id)
    .eq("user_id", memberUserId)
    .neq("role", "owner");

  if (error) {
    redirect(`/team?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "remove", entityType: "member", metadata: { memberUserId } });
  revalidatePath("/team");
  revalidatePath("/activity");
  redirect("/team?removed=1");
}

type SubmissionPayload = Record<string, string | string[]>;

async function createSubmissionAction(type: "customer" | "invoice" | "payment" | "expense", formData: FormData) {
  const { supabase, user, workspace } = await requireWorkspace();
  const payload = formDataToSubmissionPayload(formData);

  const { error } = await supabase.from("submission_queue").insert({
    workspace_id: workspace.id,
    submitted_by: user.id,
    submission_type: type,
    payload,
    status: "pending"
  });

  if (error) {
    redirect(`/submit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/submit");
  redirect(`/submit?submitted=${type}`);
}

async function approveSubmissionPayload(params: {
  supabase: WorkspaceContext["supabase"];
  user: WorkspaceContext["user"];
  workspace: WorkspaceContext["workspace"];
  type: string;
  payload: SubmissionPayload;
}): Promise<string | null> {
  const { supabase, user, workspace, type, payload } = params;

  if (type === "customer") {
    const name = getPayloadText(payload, "name");
    if (!name) throw new Error("Customer name is required.");
    const { data, error } = await supabase
      .from("customers")
      .insert({
        user_id: user.id,
        workspace_id: workspace.id,
        name,
        contact_name: getPayloadText(payload, "contact_name") || null,
        email: getPayloadText(payload, "email") || null,
        phone: getPayloadText(payload, "phone") || null,
        address: getPayloadText(payload, "address") || null,
        notes: getPayloadText(payload, "notes") || null
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message || "Could not create customer.");
    await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "approve_create", entityType: "customer", entityId: data.id });
    return data.id;
  }

  if (type === "invoice") {
    const customerId = getPayloadText(payload, "customer_id");
    const issueDate = getPayloadText(payload, "issue_date") || new Date().toISOString().slice(0, 10);
    const dueDate = getPayloadText(payload, "due_date") || null;
    const items = buildSubmittedInvoiceItems(payload);
    if (!customerId || items.length === 0) throw new Error("Customer and at least one line item are required.");

    const { data: settings } = await supabase.from("company_settings").select("invoice_prefix").eq("workspace_id", workspace.id).maybeSingle();
    const prefix = settings?.invoice_prefix || "WZX";
    const year = new Date(`${issueDate}T00:00:00`).getFullYear();
    const { data: invoiceNumber, error: numberError } = await supabase.rpc("next_workspace_invoice_number", {
      p_workspace_id: workspace.id,
      p_prefix: prefix,
      p_year: year
    });
    if (numberError || !invoiceNumber) throw new Error(numberError?.message || "Could not generate invoice number.");

    const subtotal = calculateSubtotal(items);
    const discountAmount = getPayloadMoney(payload, "discount_amount");
    const taxAmount = getPayloadMoney(payload, "tax_amount");
    const shippingAmount = getPayloadMoney(payload, "shipping_amount");
    const depositAmount = getPayloadMoney(payload, "deposit_amount");
    const totalAmount = calculateInvoiceTotal(subtotal, discountAmount, taxAmount, shippingAmount);
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        user_id: user.id,
        workspace_id: workspace.id,
        customer_id: customerId,
        invoice_number: invoiceNumber,
        status: "draft" satisfies InvoiceStatus,
        issue_date: issueDate,
        due_date: dueDate,
        subtotal,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        shipping_amount: shippingAmount,
        deposit_amount: depositAmount,
        total_amount: totalAmount,
        ship_to_name: getPayloadText(payload, "ship_to_name") || null,
        ship_to_address: getPayloadText(payload, "ship_to_address") || null,
        ship_to_contact: getPayloadText(payload, "ship_to_contact") || null,
        payment_terms: getPayloadText(payload, "payment_terms") || null,
        notes: getPayloadText(payload, "notes") || null,
        terms: getPayloadText(payload, "terms") || null
      })
      .select("id")
      .single();
    if (invoiceError || !invoice) throw new Error(invoiceError?.message || "Could not create invoice.");

    const { error: itemsError } = await supabase.from("invoice_items").insert(
      items.map((item) => ({
        user_id: user.id,
        workspace_id: workspace.id,
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: calculateLineTotal(item.quantity, item.unitPrice)
      }))
    );
    if (itemsError) {
      await supabase.from("invoices").delete().eq("id", invoice.id).eq("workspace_id", workspace.id);
      throw new Error(itemsError.message);
    }
    await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "approve_create", entityType: "invoice", entityId: invoice.id, metadata: { invoiceNumber } });
    return invoice.id;
  }

  if (type === "payment") {
    const invoiceId = getPayloadText(payload, "invoice_id");
    const amount = getPayloadMoney(payload, "amount");
    if (!invoiceId || amount <= 0) throw new Error("Invoice and payment amount are required.");
    const { data, error } = await supabase
      .from("payments")
      .insert({
        user_id: user.id,
        workspace_id: workspace.id,
        invoice_id: invoiceId,
        payment_date: getPayloadText(payload, "payment_date") || new Date().toISOString().slice(0, 10),
        amount,
        payment_method: getPayloadText(payload, "payment_method") || "other",
        reference_number: getPayloadText(payload, "reference_number") || null,
        notes: getPayloadText(payload, "notes") || null
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message || "Could not create payment.");
    const { data: invoice } = await supabase.from("invoices").select("id,status,total_amount,deposit_amount,due_date").eq("id", invoiceId).eq("workspace_id", workspace.id).single();
    if (invoice) await updateInvoiceStatus(supabase, invoice);
    await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "approve_create", entityType: "payment", entityId: data.id, metadata: { invoiceId, amount } });
    return data.id;
  }

  if (type === "expense") {
    const amount = getPayloadMoney(payload, "amount");
    if (amount <= 0) throw new Error("Expense amount is required.");
    const categoryId = await resolveExpenseCategoryId(supabase, user.id, workspace.id, payload);
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id: user.id,
        workspace_id: workspace.id,
        category_id: categoryId,
        vendor: getPayloadText(payload, "vendor") || null,
        expense_date: getPayloadText(payload, "expense_date") || new Date().toISOString().slice(0, 10),
        amount,
        payment_method: getPayloadText(payload, "payment_method") || "other",
        receipt_url: getPayloadText(payload, "receipt_url") || null,
        notes: getPayloadText(payload, "notes") || null
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message || "Could not create expense.");
    await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "approve_create", entityType: "expense", entityId: data.id, metadata: { amount } });
    return data.id;
  }

  throw new Error("Unsupported submission type.");
}

async function resolveExpenseCategoryId(supabase: WorkspaceContext["supabase"], userId: string, workspaceId: string, payload: SubmissionPayload): Promise<string | null> {
  const existingCategoryId = getPayloadText(payload, "category_id");
  if (existingCategoryId) return existingCategoryId;

  const categoryName = getPayloadText(payload, "category_name");
  if (!categoryName) return null;

  const { data: existing } = await supabase.from("expense_categories").select("id").eq("workspace_id", workspaceId).eq("name", categoryName).maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("expense_categories")
    .insert({ user_id: userId, workspace_id: workspaceId, name: categoryName })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not create expense category.");
  return data.id;
}

function formDataToSubmissionPayload(formData: FormData): SubmissionPayload {
  const payload: SubmissionPayload = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const existing = payload[key];
    if (Array.isArray(existing)) {
      existing.push(value);
    } else if (typeof existing === "string") {
      payload[key] = [existing, value];
    } else {
      payload[key] = value;
    }
  }
  return payload;
}

function getPayloadText(payload: SubmissionPayload, key: string): string {
  const value = payload[key];
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

function getPayloadArray(payload: SubmissionPayload, key: string): string[] {
  const value = payload[key];
  if (Array.isArray(value)) return value.map((entry) => String(entry));
  if (typeof value === "string") return [value];
  return [];
}

function getPayloadMoney(payload: SubmissionPayload, key: string): number {
  const parsed = Number(getPayloadText(payload, key) || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function buildSubmittedInvoiceItems(payload: SubmissionPayload) {
  const descriptions = getPayloadArray(payload, "description");
  const quantities = getPayloadArray(payload, "quantity").map((value) => Number(value || 0));
  const unitPrices = getPayloadArray(payload, "unit_price").map((value) => Number(value || 0));

  return descriptions
    .map((description, index) => ({
      description: description.trim(),
      quantity: Number.isFinite(quantities[index]) ? quantities[index] : 0,
      unitPrice: Number.isFinite(unitPrices[index]) ? unitPrices[index] : 0
    }))
    .filter((item) => item.description && item.quantity > 0);
}
