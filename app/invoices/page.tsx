import Link from "next/link";
import { ConfirmSubmitButton } from "../../components/ConfirmSubmitButton";
import { ensureUserDefaults, invoiceBalance, sumPayments } from "../../lib/data";
import { formatCurrency, formatDate } from "../../lib/format";
import { requireOwner } from "../../lib/workspace";
import { deleteInvoiceAction, duplicateInvoiceAction } from "../actions";

export const dynamic = "force-dynamic";

type InvoicesPageProps = {
  searchParams: Promise<{ deleted?: string; error?: string; q?: string; status?: string }>;
};

type InvoiceRow = {
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

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const params = await searchParams;
  const { supabase, user, workspace } = await requireOwner();
  await ensureUserDefaults(supabase, user, workspace.id);
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id,invoice_number,status,issue_date,due_date,total_amount,deposit_amount,customers(name),payments(amount)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  const rows = ((invoices ?? []) as unknown as InvoiceRow[]).filter((invoice) => {
    const query = String(params.q ?? "").trim().toLowerCase();
    const matchesQuery = !query || [invoice.invoice_number, invoice.customers?.name].some((value) => String(value ?? "").toLowerCase().includes(query));
    const matchesStatus = !params.status || invoice.status === params.status;
    return matchesQuery && matchesStatus;
  });

  return (
    <section className="card">
      <div className="page-header">
        <div>
          <h1>Invoices</h1>
          <p className="muted">Invoice number, client, total, paid, balance, and status.</p>
        </div>
        <Link className="primary-link" href="/invoices/new">
          New Invoice
        </Link>
      </div>

      {params.error ? <div className="notice error">{params.error}</div> : null}
      {params.deleted ? <div className="notice success">Invoice deleted.</div> : null}

      <form className="filter-bar">
        <label>
          Search invoices
          <input name="q" defaultValue={params.q ?? ""} placeholder="Invoice number or customer" />
        </label>
        <label>
          Status
          <select name="status" defaultValue={params.status ?? ""}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="partially_paid">Partially paid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <div className="action-row">
          <button type="submit" className="secondary-button compact-action">
            Filter
          </button>
          <Link className="secondary-link compact-action" href="/invoices">
            Clear
          </Link>
        </div>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Client</th>
              <th>Issue</th>
              <th>Due</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((invoice) => (
              <tr key={invoice.id}>
                <td>
                  <Link href={`/invoices/${invoice.id}`}>{invoice.invoice_number}</Link>
                </td>
                <td>{invoice.customers?.name || "No customer"}</td>
                <td>{formatDate(invoice.issue_date)}</td>
                <td>{formatDate(invoice.due_date)}</td>
                <td>{formatCurrency(invoice.total_amount)}</td>
                <td>{formatCurrency(Number(invoice.deposit_amount ?? 0) + sumPayments(invoice.payments))}</td>
                <td>{formatCurrency(invoiceBalance(invoice))}</td>
                <td>
                  <span className="status-pill">{invoice.status.replace("_", " ")}</span>
                </td>
                <td>
                  <div className="action-row">
                    <form action={duplicateInvoiceAction}>
                      <input type="hidden" name="invoice_id" value={invoice.id} />
                      <button type="submit" className="secondary-button compact-action">
                        Duplicate
                      </button>
                    </form>
                    <form action={deleteInvoiceAction}>
                      <input type="hidden" name="invoice_id" value={invoice.id} />
                      <input type="hidden" name="return_to" value="/invoices" />
                      <ConfirmSubmitButton className="secondary-button danger-button compact-action" confirmMessage={`Delete invoice ${invoice.invoice_number}? This cannot be undone.`}>
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-cell">
                  No invoices yet. Create one after adding a customer.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
