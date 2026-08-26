import Link from "next/link";
import { ConfirmSubmitButton } from "../../components/ConfirmSubmitButton";
import { StatCard } from "../../components/StatCard";
import { ensureUserDefaults, invoiceBalance, sumPayments } from "../../lib/data";
import { formatCurrency, formatDate } from "../../lib/format";
import { requireOwner } from "../../lib/workspace";
import { deleteInvoiceAction } from "../actions";

export const dynamic = "force-dynamic";

type ReportsPageProps = {
  searchParams: Promise<{ deleted?: string; error?: string }>;
};

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  total_amount: number | string;
  deposit_amount: number | string;
  customers: { name: string } | null;
  payments: { amount: number | string | null }[] | null;
};

type Payment = {
  amount: number | string;
  payment_date: string;
};

type Expense = {
  amount: number | string;
  expense_date: string;
  expense_categories: { name: string } | null;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const { supabase, user, workspace } = await requireOwner();
  await ensureUserDefaults(supabase, user, workspace.id);
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartText = monthStart.toISOString().slice(0, 10);
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id,invoice_number,status,issue_date,due_date,total_amount,deposit_amount,customers(name),payments(amount)")
    .eq("workspace_id", workspace.id)
    .order("issue_date", { ascending: false });
  const { data: payments } = await supabase.from("payments").select("amount,payment_date").eq("workspace_id", workspace.id).gte("payment_date", monthStartText);
  const { data: expenses } = await supabase.from("expenses").select("amount,expense_date,expense_categories(name)").eq("workspace_id", workspace.id).gte("expense_date", monthStartText);

  const invoiceRows = (invoices ?? []) as unknown as Invoice[];
  const paymentRows = (payments ?? []) as unknown as Payment[];
  const expenseRows = (expenses ?? []) as unknown as Expense[];
  const monthlySales = invoiceRows.filter((invoice) => invoice.issue_date >= monthStartText).reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);
  const monthlyReceived =
    paymentRows.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0) +
    invoiceRows.filter((invoice) => invoice.issue_date >= monthStartText).reduce((sum, invoice) => sum + Number(invoice.deposit_amount ?? 0), 0);
  const monthlyExpenses = expenseRows.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const outstandingInvoices = invoiceRows.filter((invoice) => invoiceBalance(invoice) > 0);
  const overdueInvoices = outstandingInvoices.filter((invoice) => invoice.status === "overdue");

  return (
    <section className="grid">
      <div>
        <h1>Reports</h1>
        <p className="muted">Monthly sales, received payments, expenses, outstanding invoices, and overdue invoices.</p>
      </div>

      {params.error ? <div className="notice error">{params.error}</div> : null}
      {params.deleted ? <div className="notice success">Invoice deleted. Reports were recalculated from current records.</div> : null}

      <div className="grid grid-3">
        <StatCard label="Monthly Sales" value={formatCurrency(monthlySales)} />
        <StatCard label="Monthly Received" value={formatCurrency(monthlyReceived)} />
        <StatCard label="Monthly Expenses" value={formatCurrency(monthlyExpenses)} />
        <StatCard label="Outstanding Invoices" value={String(outstandingInvoices.length)} />
        <StatCard label="Overdue Invoices" value={String(overdueInvoices.length)} />
        <StatCard label="Estimated Net" value={formatCurrency(monthlyReceived - monthlyExpenses)} />
      </div>

      <div className="card">
        <h2>Outstanding Invoices</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Client</th>
                <th>Due</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {outstandingInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <Link href={`/invoices/${invoice.id}`}>{invoice.invoice_number}</Link>
                  </td>
                  <td>{invoice.customers?.name || "No customer"}</td>
                  <td>{formatDate(invoice.due_date)}</td>
                  <td>{formatCurrency(Number(invoice.deposit_amount ?? 0) + sumPayments(invoice.payments))}</td>
                  <td>{formatCurrency(invoiceBalance(invoice))}</td>
                  <td>
                    <span className="status-pill">{invoice.status.replace("_", " ")}</span>
                  </td>
                  <td>
                    <form action={deleteInvoiceAction}>
                      <input type="hidden" name="invoice_id" value={invoice.id} />
                      <input type="hidden" name="return_to" value="/reports" />
                      <ConfirmSubmitButton className="secondary-button danger-button compact-action" confirmMessage={`Delete invoice ${invoice.invoice_number}? This cannot be undone.`}>
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
              {outstandingInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    No outstanding invoices.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
