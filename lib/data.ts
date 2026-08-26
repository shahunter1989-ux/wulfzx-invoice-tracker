import type { SupabaseClient, User } from "@supabase/supabase-js";
import { calculateBalanceDue, calculateInvoiceStatus } from "./calculations";
import { DEFAULT_INVOICE_TEMPLATE } from "./invoiceTemplates";

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Software",
  "Hosting",
  "Marketing",
  "Equipment",
  "Contractors",
  "Office",
  "Travel",
  "Fees",
  "Other"
];

type PaymentRow = { amount: number | string | null };
type InvoiceStatusInput = {
  id: string;
  status?: string | null;
  total_amount: number | string | null;
  deposit_amount?: number | string | null;
  due_date?: string | null;
};

export async function ensureUserDefaults(supabase: SupabaseClient, user: User, workspaceId?: string) {
  await supabase.from("company_settings").upsert(
    {
      user_id: user.id,
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
      company_name: "WZXU",
      default_currency: "USD",
      invoice_prefix: "WZXU",
      invoice_template: DEFAULT_INVOICE_TEMPLATE
    },
    { onConflict: workspaceId ? "workspace_id" : "user_id", ignoreDuplicates: true }
  );

  await supabase.from("expense_categories").upsert(
    DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ user_id: user.id, ...(workspaceId ? { workspace_id: workspaceId } : {}), name })),
    { onConflict: workspaceId ? "workspace_id,name" : "user_id,name", ignoreDuplicates: true }
  );
}

export function sumPayments(payments: PaymentRow[] | null | undefined): number {
  return roundMoney((payments ?? []).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0));
}

export function invoiceBalance(invoice: { total_amount: number | string | null; deposit_amount?: number | string | null; payments?: PaymentRow[] | null }): number {
  return calculateBalanceDue(Number(invoice.total_amount ?? 0), Number(invoice.deposit_amount ?? 0) + sumPayments(invoice.payments));
}

export async function updateInvoiceStatus(supabase: SupabaseClient, invoice: InvoiceStatusInput) {
  const { data: payments } = await supabase.from("payments").select("amount").eq("invoice_id", invoice.id);
  const amountReceived = Number(invoice.deposit_amount ?? 0) + sumPayments(payments);
  const status = calculateInvoiceStatus({
    currentStatus: invoice.status === "cancelled" ? "cancelled" : undefined,
    totalAmount: Number(invoice.total_amount ?? 0),
    amountReceived,
    dueDate: invoice.due_date
  });

  await supabase.from("invoices").update({ status }).eq("id", invoice.id);
  return status;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
