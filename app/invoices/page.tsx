import Link from "next/link";
import { ConfirmSubmitButton } from "../../components/ConfirmSubmitButton";
import { ensureUserDefaults, invoiceBalance, sumPayments } from "../../lib/data";
import { formatCurrency, formatDate } from "../../lib/format";
import { requireOwner } from "../../lib/workspace";
import { deleteInvoiceAction } from "../actions";

export const dynamic = "force-dynamic";

type InvoicesPageProps = {
  searchParams: Promise<{ deleted?: string; error?: string }>;
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
            {((invoices ?? []) as unknown as InvoiceRow[]).map((invoice) => (
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
                  <form action={deleteInvoiceAction}>
                    <input type="hidden" name="invoice_id" value={invoice.id} />
                    <input type="hidden" name="return_to" value="/invoices" />
                    <ConfirmSubmitButton className="secondary-button danger-button compact-action" confirmMessage={`Delete invoice ${invoice.invoice_number}? This cannot be undone.`}>
                      Delete
                    </ConfirmSubmitButton>
                  </form>
                </td>
              </tr>
            ))}
            {(invoices ?? []).length === 0 ? (
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
