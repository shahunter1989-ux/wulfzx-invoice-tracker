import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { InvoiceStatus } from "../../../../lib/types";
import { calculateInvoiceTotal, calculateLineTotal, calculateSubtotal } from "../../../../lib/calculations";
import { ensureUserDefaults, updateInvoiceStatus } from "../../../../lib/data";
import { logAuditEvent } from "../../../../lib/audit";
import { DEFAULT_INVOICE_TEMPLATE, normalizeInvoiceTemplate } from "../../../../lib/invoiceTemplates";
import { requireWorkspace, type WorkspaceContext } from "../../../../lib/workspace";

type DraftType = "customer" | "invoice" | "payment" | "expense";
type DraftPayload = Record<string, string | string[]>;
type SyncDraft = {
  id: string;
  type: DraftType;
  payload: DraftPayload;
};

type SyncResult = {
  id: string;
  ok: boolean;
  error?: string;
};

type InvoiceDraftItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

const OWNER_REVALIDATE_PATHS = ["/dashboard", "/customers", "/invoices", "/payments", "/receipts", "/reports"];

export async function POST(request: Request) {
  const context = await requireWorkspace();
  const { supabase, user, workspace } = context;
  if (context.isOwner) {
    await ensureUserDefaults(supabase, user, workspace.id);
  }

  const body = (await request.json().catch(() => null)) as { drafts?: SyncDraft[] } | null;
  const drafts = Array.isArray(body?.drafts) ? body.drafts : [];

  if (drafts.length === 0) {
    return NextResponse.json({ results: [] satisfies SyncResult[] });
  }

  const results: SyncResult[] = [];
  let changed = false;

  for (const draft of drafts) {
    try {
      if (!draft.id || !draft.type || !draft.payload) {
        throw new Error("Draft is missing required sync data.");
      }

      if (context.isSubmitter) {
        await syncSubmitterDraft(context, draft);
      } else if (draft.type === "customer") {
        await syncCustomerDraft(context, draft.payload);
      } else if (draft.type === "invoice") {
        await syncInvoiceDraft(context, draft.payload);
      } else if (draft.type === "payment") {
        await syncPaymentDraft(context, draft.payload);
      } else if (draft.type === "expense") {
        await syncExpenseDraft(context, draft.payload);
      } else {
        throw new Error("Unsupported draft type.");
      }

      changed = true;
      results.push({ id: draft.id, ok: true });
    } catch (error) {
      results.push({
        id: draft.id,
        ok: false,
        error: error instanceof Error ? error.message : "Draft sync failed."
      });
    }
  }

  if (changed) {
    if (context.isOwner) {
      OWNER_REVALIDATE_PATHS.forEach((path) => revalidatePath(path));
    } else {
      revalidatePath("/submit");
    }
    revalidatePath("/offline");
  }

  return NextResponse.json({ results });
}

async function syncSubmitterDraft(context: WorkspaceContext, draft: SyncDraft) {
  const { supabase, user, workspace } = context;
  const { error } = await supabase.from("submission_queue").insert({
    workspace_id: workspace.id,
    submitted_by: user.id,
    submission_type: draft.type,
    payload: draft.payload,
    status: "pending"
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function syncCustomerDraft(context: WorkspaceContext, payload: DraftPayload) {
  const { supabase, user, workspace } = context;
  const name = getText(payload, "name");
  if (!name) {
    throw new Error("Customer name is required.");
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      user_id: user.id,
      workspace_id: workspace.id,
      name,
      contact_name: getText(payload, "contact_name") || null,
      email: getText(payload, "email") || null,
      phone: getText(payload, "phone") || null,
      address: getText(payload, "address") || null,
      notes: getText(payload, "notes") || null
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Could not save customer.");
  }

  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "offline_sync", entityType: "customer", entityId: data.id });
}

async function syncInvoiceDraft(context: WorkspaceContext, payload: DraftPayload) {
  const { supabase, user, workspace } = context;
  const customerId = getText(payload, "customer_id");
  const issueDate = getText(payload, "issue_date") || new Date().toISOString().slice(0, 10);
  const dueDate = getText(payload, "due_date") || null;
  const items = buildInvoiceItems(payload);

  if (!customerId || items.length === 0) {
    throw new Error("Customer and at least one invoice line item are required.");
  }

  const { data: settings } = await supabase.from("company_settings").select("invoice_prefix,invoice_template").eq("workspace_id", workspace.id).maybeSingle();
  const prefix = settings?.invoice_prefix || "WZXU";
  const invoiceTemplate = normalizeInvoiceTemplate(getText(payload, "invoice_template") || settings?.invoice_template || DEFAULT_INVOICE_TEMPLATE);
  const year = new Date(`${issueDate}T00:00:00`).getFullYear();
  const { data: invoiceNumber, error: numberError } = await supabase.rpc("next_workspace_invoice_number", {
    p_workspace_id: workspace.id,
    p_prefix: prefix,
    p_year: year
  });

  if (numberError || !invoiceNumber) {
    throw new Error(numberError?.message || "Could not generate invoice number.");
  }

  const subtotal = calculateSubtotal(items);
  const discountAmount = getMoney(payload, "discount_amount");
  const taxAmount = getMoney(payload, "tax_amount");
  const shippingAmount = getMoney(payload, "shipping_amount");
  const depositAmount = getMoney(payload, "deposit_amount");
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
      invoice_template: invoiceTemplate,
      ship_to_name: getText(payload, "ship_to_name") || null,
      ship_to_address: getText(payload, "ship_to_address") || null,
      ship_to_contact: getText(payload, "ship_to_contact") || null,
      payment_terms: getText(payload, "payment_terms") || null,
      notes: getText(payload, "notes") || null,
      terms: getText(payload, "terms") || null
    })
    .select("id")
    .single();

  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message || "Could not save invoice.");
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
    await supabase.from("invoices").delete().eq("id", invoice.id).eq("workspace_id", workspace.id);
    throw new Error(itemsError.message);
  }

  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "offline_sync", entityType: "invoice", entityId: invoice.id, metadata: { invoiceNumber } });
}

async function syncPaymentDraft(context: WorkspaceContext, payload: DraftPayload) {
  const { supabase, user, workspace } = context;
  const invoiceId = getText(payload, "invoice_id");
  const amount = getMoney(payload, "amount");

  if (!invoiceId || amount <= 0) {
    throw new Error("Invoice and payment amount are required.");
  }

  const { data, error } = await supabase
    .from("payments")
    .insert({
      user_id: user.id,
      workspace_id: workspace.id,
      invoice_id: invoiceId,
      payment_date: getText(payload, "payment_date") || new Date().toISOString().slice(0, 10),
      amount,
      payment_method: getText(payload, "payment_method") || "other",
      reference_number: getText(payload, "reference_number") || null,
      notes: getText(payload, "notes") || null
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Could not save payment.");
  }

  const { data: invoice } = await supabase.from("invoices").select("id,status,total_amount,deposit_amount,due_date").eq("id", invoiceId).eq("workspace_id", workspace.id).single();
  if (invoice) {
    await updateInvoiceStatus(supabase, invoice);
  }

  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "offline_sync", entityType: "payment", entityId: data.id, metadata: { invoiceId, amount } });
}

async function syncExpenseDraft(context: WorkspaceContext, payload: DraftPayload) {
  const { supabase, user, workspace } = context;
  const amount = getMoney(payload, "amount");
  if (amount <= 0) {
    throw new Error("Expense amount is required.");
  }

  const categoryId = await resolveExpenseCategoryId(context, payload);
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: user.id,
      workspace_id: workspace.id,
      category_id: categoryId,
      vendor: getText(payload, "vendor") || null,
      expense_date: getText(payload, "expense_date") || new Date().toISOString().slice(0, 10),
      amount,
      payment_method: getText(payload, "payment_method") || "other",
      receipt_url: getText(payload, "receipt_url") || null,
      notes: getText(payload, "notes") || null
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Could not save expense.");
  }

  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "offline_sync", entityType: "expense", entityId: data.id, metadata: { amount } });
}

async function resolveExpenseCategoryId(context: WorkspaceContext, payload: DraftPayload): Promise<string | null> {
  const existingCategoryId = getText(payload, "category_id");
  if (existingCategoryId) return existingCategoryId;

  const categoryName = getText(payload, "category_name");
  if (!categoryName) return null;

  const { supabase, user, workspace } = context;
  const { data: existing } = await supabase.from("expense_categories").select("id").eq("workspace_id", workspace.id).eq("name", categoryName).maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("expense_categories")
    .insert({ user_id: user.id, workspace_id: workspace.id, name: categoryName })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not create expense category.");
  return data.id;
}

function buildInvoiceItems(payload: DraftPayload): InvoiceDraftItem[] {
  const descriptions = getArray(payload, "description");
  const quantities = getArray(payload, "quantity").map(parseMoney);
  const unitPrices = getArray(payload, "unit_price").map(parseMoney);

  return descriptions
    .map((description, index) => ({
      description: description.trim(),
      quantity: quantities[index] || 0,
      unitPrice: unitPrices[index] || 0
    }))
    .filter((item) => item.description && item.quantity > 0);
}

function getText(payload: DraftPayload, key: string): string {
  const value = payload[key];
  if (Array.isArray(value)) {
    return String(value[0] ?? "").trim();
  }
  return String(value ?? "").trim();
}

function getArray(payload: DraftPayload, key: string): string[] {
  const value = payload[key];
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }
  if (typeof value === "string") {
    return [value];
  }
  return [];
}

function getMoney(payload: DraftPayload, key: string): number {
  return parseMoney(getText(payload, key));
}

function parseMoney(value: string): number {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}
