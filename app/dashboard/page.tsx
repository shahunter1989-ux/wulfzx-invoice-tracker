import Link from "next/link";
import { StatCard } from "../../components/StatCard";
import { ensureUserDefaults, invoiceBalance, sumPayments } from "../../lib/data";
import { formatCurrency, formatDate } from "../../lib/format";
import { requireOwner } from "../../lib/workspace";

export const dynamic = "force-dynamic";

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  due_date: string | null;
  total_amount: number | string;
  deposit_amount: number | string;
  customers: { name: string } | null;
  payments: { amount: number | string | null }[] | null;
};

type Expense = {
  amount: number | string;
};

export default async function DashboardPage() {
  const { supabase, user, workspace } = await requireOwner();
  await ensureUserDefaults(supabase, user, workspace.id);
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id,invoice_number,status,due_date,total_amount,deposit_amount,customers(name),payments(amount)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });
  const { data: expenses } = await supabase.from("expenses").select("amount").eq("workspace_id", workspace.id);

  const invoiceRows = (invoices ?? []) as unknown as Invoice[];
  const expenseRows = (expenses ?? []) as unknown as Expense[];
  const totalSales = invoiceRows.reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);
  const totalReceived = invoiceRows.reduce((sum, invoice) => sum + Number(invoice.deposit_amount ?? 0) + sumPayments(invoice.payments), 0);
  const outstanding = invoiceRows.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);
  const totalExpenses = expenseRows.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const overdue = invoiceRows.filter((invoice) => invoice.status === "overdue").length;

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Overview of Wulfzx.underground sales, payments, and expenses.</p>
        </div>
        <div className="action-row">
          <Link className="primary-link" href="/customers/new">
            New Customer
          </Link>
          <Link className="primary-link" href="/invoices/new">
            New Invoice
          </Link>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginTop: 24 }}>
        <StatCard label="Total Sales" value={formatCurrency(totalSales)} />
        <StatCard label="Total Received" value={formatCurrency(totalReceived)} />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} />
        <StatCard label="Overdue" value={String(overdue)} />
        <StatCard label="Expenses" value={formatCurrency(totalExpenses)} />
        <StatCard label="Estimated Net" value={formatCurrency(totalReceived - totalExpenses)} />
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h2>Recent Invoices</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Client</th>
                <th>Due</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoiceRows.slice(0, 8).map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <Link href={`/invoices/${invoice.id}`}>{invoice.invoice_number}</Link>
                  </td>
                  <td>{invoice.customers?.name || "No customer"}</td>
                  <td>{formatDate(invoice.due_date)}</td>
                  <td>{formatCurrency(invoiceBalance(invoice))}</td>
                  <td>
                    <span className="status-pill">{invoice.status.replace("_", " ")}</span>
                  </td>
                </tr>
              ))}
              {invoiceRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    No invoices yet.
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
