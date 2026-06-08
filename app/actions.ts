"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { InvoiceStatus } from "../lib/types";
import { calculateLineTotal, calculateSubtotal, calculateInvoiceTotal } from "../lib/calculations";
import { ensureUserDefaults, updateInvoiceStatus } from "../lib/data";
import { toMoney, toText } from "../lib/format";
import { requireUser, getUserIfConfigured } from "../lib/auth";
import { createClient } from "../lib/supabase/server";

export async function signInAction(formData: FormData) {
  const email = toText(formData.get("email"));
  const password = toText(formData.get("password"));
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
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
  const { supabase, user } = await requireUser();
  await ensureUserDefaults(supabase, user);

  const name = toText(formData.get("name"));
  if (!name) {
    redirect("/customers/new?error=Customer%20name%20is%20required");
  }

  const { error } = await supabase.from("customers").insert({
    user_id: user.id,
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

  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomerAction(formData: FormData) {
  const { supabase, user } = await requireUser();
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
    .eq("user_id", user.id);

  if (error) {
    redirect(`/customers/${customerId}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}/edit`);
  redirect("/customers?saved=1");
}

export async function deleteCustomerAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const customerId = toText(formData.get("customer_id"));

  if (!customerId) {
    redirect("/customers?error=Customer%20record%20is%20required");
  }

  const { count, error: countError } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .eq("user_id", user.id);

  if (countError) {
    redirect(`/customers?error=${encodeURIComponent(countError.message)}`);
  }

  if ((count ?? 0) > 0) {
    redirect("/customers?error=Customers%20with%20invoices%20cannot%20be%20deleted");
  }

  const { error } = await supabase.from("customers").delete().eq("id", customerId).eq("user_id", user.id);

  if (error) {
    redirect(`/customers?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/customers");
  redirect("/customers?deleted=1");
}

export async function createInvoiceAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  await ensureUserDefaults(supabase, user);

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

  const { data: settings } = await supabase.from("company_settings").select("invoice_prefix").eq("user_id", user.id).maybeSingle();
  const prefix = settings?.invoice_prefix || "WZX";
  const year = new Date(`${issueDate}T00:00:00`).getFullYear();
  const { data: invoiceNumber, error: numberError } = await supabase.rpc("next_invoice_number", {
    p_prefix: prefix,
    p_year: year
  });

  if (numberError || !invoiceNumber) {
    redirect(`/invoices/new?error=${encodeURIComponent(numberError?.message || "Could not generate invoice number")}`);
  }

  const subtotal = calculateSubtotal(items);
  const discountAmount = toMoney(formData.get("discount_amount"));
  const taxAmount = toMoney(formData.get("tax_amount"));
  const totalAmount = calculateInvoiceTotal(subtotal, discountAmount, taxAmount);

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      customer_id: customerId,
      invoice_number: invoiceNumber,
      status: "draft" satisfies InvoiceStatus,
      issue_date: issueDate,
      due_date: dueDate,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
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

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function deleteInvoiceAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const invoiceId = toText(formData.get("invoice_id"));

  if (!invoiceId) {
    redirect("/invoices?error=Invoice%20record%20is%20required");
  }

  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId).eq("user_id", user.id);

  if (error) {
    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath("/payments");
  revalidatePath("/reports");
  redirect("/invoices?deleted=1");
}

export async function markInvoiceStatusAction(formData: FormData) {
  const { supabase } = await requireUser();
  const invoiceId = toText(formData.get("invoice_id"));
  const status = toText(formData.get("status")) as InvoiceStatus;

  if (!invoiceId || !["draft", "sent", "cancelled"].includes(status)) {
    redirect("/invoices");
  }

  await supabase.from("invoices").update({ status }).eq("id", invoiceId);
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}`);
}

export async function recordPaymentAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const invoiceId = toText(formData.get("invoice_id"));
  const amount = toMoney(formData.get("amount"));

  if (!invoiceId || amount <= 0) {
    redirect("/payments?error=Invoice%20and%20payment%20amount%20are%20required");
  }

  const { error } = await supabase.from("payments").insert({
    user_id: user.id,
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

  const { data: invoice } = await supabase.from("invoices").select("id,status,total_amount,due_date").eq("id", invoiceId).single();
  if (invoice) {
    await updateInvoiceStatus(supabase, invoice);
  }

  revalidatePath("/dashboard");
  revalidatePath("/payments");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}`);
}

export async function createExpenseAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  await ensureUserDefaults(supabase, user);

  const amount = toMoney(formData.get("amount"));
  if (amount <= 0) {
    redirect("/receipts?error=Amount%20is%20required");
  }

  const { error } = await supabase.from("expenses").insert({
    user_id: user.id,
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

  revalidatePath("/dashboard");
  revalidatePath("/receipts");
  revalidatePath("/reports");
  redirect("/receipts");
}

export async function updateSettingsAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("company_settings").upsert(
    {
      user_id: user.id,
      company_name: toText(formData.get("company_name")) || "Wulfzx.underground",
      company_email: toText(formData.get("company_email")) || null,
      company_phone: toText(formData.get("company_phone")) || null,
      company_address: toText(formData.get("company_address")) || null,
      default_currency: toText(formData.get("default_currency")) || "USD",
      default_tax_rate: toMoney(formData.get("default_tax_rate")),
      invoice_prefix: toText(formData.get("invoice_prefix")) || "WZX"
    },
    { onConflict: "user_id" }
  );

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/settings");
  redirect("/settings?saved=1");
}
