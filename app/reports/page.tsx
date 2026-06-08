import Link from "next/link";
import { StatCard } from "../../components/StatCard";
import { requireUser } from "../../lib/auth";
import { ensureUserDefaults, invoiceBalance, sumPayments } from "../../lib/data";
import { formatCurrency, formatDate } from "../../lib/format";

export const dynamic = "force-dynamic";

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  total_amount: number | string;
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

export default async function ReportsPage() {
  const { supabase, user } = await requireUser();
  await ensureUserDefaults(supabase, user);
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartText = monthStart.toISOString().slice(0, 10);
  const { data: invoices } = await supabase.from("invoices").select("id,invoice_number,status,issue_date,due_date,total_amount,customers(name),payments(amount)").order("issue_date", { ascending: false });
  const { data: payments } = await supabase.from("payments").select("amount,payment_date").gte("payment_date", monthStartText);
  const { data: expenses } = await supabase.from("expenses").select("amount,expense_date,expense_categories(name)").gte("expense_date", monthStartText);

  const invoiceRows = (invoices ?? []) as unknown as Invoice[];
  const paymentRows = (payments ?? []) as unknown as Payment[];
  const expenseRows = (expenses ?? []) as unknown as Expense[];
  const monthlySales = invoiceRows.filter((invoice) => invoice.issue_date >= monthStartText).reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);
  const monthlyReceived = paymentRows.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const monthlyExpenses = expenseRows.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const outstandingInvoices = invoiceRows.filter((invoice) => invoiceBalance(invoice) > 0);
  const overdueInvoices = outstandingInvoices.filter((invoice) => invoice.status === "overdue");

  return (
    <section className="grid">
      <div>
        <h1>Reports</h1>
        <p className="muted">Monthly sales, received payments, expenses, outstanding invoices, and overdue invoices.</p>
      </div>

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
                  <td>{formatCurrency(sumPayments(invoice.payments))}</td>
                  <td>{formatCurrency(invoiceBalance(invoice))}</td>
                  <td>
                    <span className="status-pill">{invoice.status.replace("_", " ")}</span>
                  </td>
                </tr>
              ))}
              {outstandingInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-cell">
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
