import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { InvoiceStatus } from "../../../../lib/types";
import { calculateInvoiceTotal, calculateLineTotal, calculateSubtotal } from "../../../../lib/calculations";
import { requireUser } from "../../../../lib/auth";
import { ensureUserDefaults, updateInvoiceStatus } from "../../../../lib/data";

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

const REVALIDATE_PATHS = ["/dashboard", "/customers", "/invoices", "/payments", "/receipts", "/reports"];

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  await ensureUserDefaults(supabase, user);

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

      if (draft.type === "customer") {
        await syncCustomerDraft(supabase, user.id, draft.payload);
      } else if (draft.type === "invoice") {
        await syncInvoiceDraft(supabase, user.id, draft.payload);
      } else if (draft.type === "payment") {
        await syncPaymentDraft(supabase, user.id, draft.payload);
      } else if (draft.type === "expense") {
        await syncExpenseDraft(supabase, user.id, draft.payload);
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
    REVALIDATE_PATHS.forEach((path) => revalidatePath(path));
  }

  return NextResponse.json({ results });
}

async function syncCustomerDraft(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, payload: DraftPayload) {
  const name = getText(payload, "name");
  if (!name) {
    throw new Error("Customer name is required.");
  }

  const { error } = await supabase.from("customers").insert({
    user_id: userId,
    name,
    contact_name: getText(payload, "contact_name") || null,
    email: getText(payload, "email") || null,
    phone: getText(payload, "phone") || null,
    address: getText(payload, "address") || null,
    notes: getText(payload, "notes") || null
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function syncInvoiceDraft(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, payload: DraftPayload) {
  const customerId = getText(payload, "customer_id");
  const issueDate = getText(payload, "issue_date") || new Date().toISOString().slice(0, 10);
  const dueDate = getText(payload, "due_date") || null;
  const items = buildInvoiceItems(payload);

  if (!customerId || items.length === 0) {
    throw new Error("Customer and at least one invoice line item are required.");
  }

  const { data: settings } = await supabase.from("company_settings").select("invoice_prefix").eq("user_id", userId).maybeSingle();
  const prefix = settings?.invoice_prefix || "WZX";
  const year = new Date(`${issueDate}T00:00:00`).getFullYear();
  const { data: invoiceNumber, error: numberError } = await supabase.rpc("next_invoice_number", {
    p_prefix: prefix,
    p_year: year
  });

  if (numberError || !invoiceNumber) {
    throw new Error(numberError?.message || "Could not generate invoice number.");
  }

  const subtotal = calculateSubtotal(items);
  const discountAmount = getMoney(payload, "discount_amount");
  const taxAmount = getMoney(payload, "tax_amount");
  const totalAmount = calculateInvoiceTotal(subtotal, discountAmount, taxAmount);

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      user_id: userId,
      customer_id: customerId,
      invoice_number: invoiceNumber,
      status: "draft" satisfies InvoiceStatus,
      issue_date: issueDate,
      due_date: dueDate,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
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
      user_id: userId,
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: calculateLineTotal(item.quantity, item.unitPrice)
    }))
  );

  if (itemsError) {
    await supabase.from("invoices").delete().eq("id", invoice.id).eq("user_id", userId);
    throw new Error(itemsError.message);
  }
}

async function syncPaymentDraft(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, payload: DraftPayload) {
  const invoiceId = getText(payload, "invoice_id");
  const amount = getMoney(payload, "amount");

  if (!invoiceId || amount <= 0) {
    throw new Error("Invoice and payment amount are required.");
  }

  const { error } = await supabase.from("payments").insert({
    user_id: userId,
    invoice_id: invoiceId,
    payment_date: getText(payload, "payment_date") || new Date().toISOString().slice(0, 10),
    amount,
    payment_method: getText(payload, "payment_method") || "other",
    reference_number: getText(payload, "reference_number") || null,
    notes: getText(payload, "notes") || null
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data: invoice } = await supabase.from("invoices").select("id,status,total_amount,due_date").eq("id", invoiceId).eq("user_id", userId).single();
  if (invoice) {
    await updateInvoiceStatus(supabase, invoice);
  }
}

async function syncExpenseDraft(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, payload: DraftPayload) {
  const amount = getMoney(payload, "amount");
  if (amount <= 0) {
    throw new Error("Expense amount is required.");
  }

  const { error } = await supabase.from("expenses").insert({
    user_id: userId,
    category_id: getText(payload, "category_id") || null,
    vendor: getText(payload, "vendor") || null,
    expense_date: getText(payload, "expense_date") || new Date().toISOString().slice(0, 10),
    amount,
    payment_method: getText(payload, "payment_method") || "other",
    receipt_url: getText(payload, "receipt_url") || null,
    notes: getText(payload, "notes") || null
  });

  if (error) {
    throw new Error(error.message);
  }
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
