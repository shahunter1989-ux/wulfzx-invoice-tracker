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
  expense_date: string;
};

type Payment = {
  amount: number | string;
  payment_date: string;
};

export default async function DashboardPage() {
  const { supabase, user, workspace } = await requireOwner();
  await ensureUserDefaults(supabase, user, workspace.id);
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id,invoice_number,status,due_date,total_amount,deposit_amount,customers(name),payments(amount)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });
  const [{ data: expenses }, { data: payments }, { count: pendingApprovals }] = await Promise.all([
    supabase.from("expenses").select("amount,expense_date").eq("workspace_id", workspace.id),
    supabase.from("payments").select("amount,payment_date").eq("workspace_id", workspace.id),
    supabase.from("submission_queue").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("status", "pending")
  ]);

  const invoiceRows = (invoices ?? []) as unknown as Invoice[];
  const expenseRows = (expenses ?? []) as unknown as Expense[];
  const paymentRows = (payments ?? []) as unknown as Payment[];
  const monthStartText = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const totalSales = invoiceRows.reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);
  const totalReceived = invoiceRows.reduce((sum, invoice) => sum + Number(invoice.deposit_amount ?? 0) + sumPayments(invoice.payments), 0);
  const outstanding = invoiceRows.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);
  const totalExpenses = expenseRows.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const paidThisMonth = paymentRows.filter((payment) => payment.payment_date >= monthStartText).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const expensesThisMonth = expenseRows.filter((expense) => expense.expense_date >= monthStartText).reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const draftInvoices = invoiceRows.filter((invoice) => invoice.status === "draft");
  const overdueInvoices = invoiceRows.filter((invoice) => invoice.status === "overdue" || (invoice.due_date && invoice.due_date < new Date().toISOString().slice(0, 10) && invoiceBalance(invoice) > 0));
  const needsAttention = [...overdueInvoices, ...draftInvoices.filter((draft) => !overdueInvoices.some((invoice) => invoice.id === draft.id))].slice(0, 8);

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Overview of WZXU sales, payments, and expenses.</p>
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
        <StatCard label="Unpaid Balance" value={formatCurrency(outstanding)} />
        <StatCard label="Overdue Invoices" value={String(overdueInvoices.length)} />
        <StatCard label="Paid This Month" value={formatCurrency(paidThisMonth)} />
        <StatCard label="Expenses This Month" value={formatCurrency(expensesThisMonth)} />
        <StatCard label="Estimated Net This Month" value={formatCurrency(paidThisMonth - expensesThisMonth)} />
        <StatCard label="Pending Approvals" value={String(pendingApprovals ?? 0)} />
      </div>

      <div className="grid grid-3" style={{ marginTop: 24 }}>
        <div className="card">
          <h2>Needs Attention</h2>
          <div className="mini-list">
            {needsAttention.map((invoice) => (
              <div key={invoice.id}>
                <strong>
                  <Link href={`/invoices/${invoice.id}`}>{invoice.invoice_number}</Link>
                </strong>
                <span>
                  {invoice.customers?.name || "No customer"} - {formatCurrency(invoiceBalance(invoice))} due - {invoice.status.replace("_", " ")}
                </span>
              </div>
            ))}
            {needsAttention.length === 0 ? <p className="muted">No overdue or draft invoices need attention.</p> : null}
          </div>
        </div>
        <div className="card">
          <h2>Owner Shortcuts</h2>
          <div className="quick-link-list">
            <Link href="/customers/new">Add customer</Link>
            <Link href="/invoices/new">Create invoice</Link>
            <Link href="/payments">Record payment</Link>
            <Link href="/receipts">Add receipt or expense</Link>
          </div>
        </div>
        <div className="card">
          <h2>Workflow Checks</h2>
          <div className="mini-list">
            <div>
              <strong>{pendingApprovals ?? 0} pending approvals</strong>
              <span>
                <Link href="/approvals">Review staff submissions</Link>
              </span>
            </div>
            <div>
              <strong>Offline drafts</strong>
              <span>
                <Link href="/offline">Check this device for unsynced work</Link>
              </span>
            </div>
          </div>
        </div>
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
