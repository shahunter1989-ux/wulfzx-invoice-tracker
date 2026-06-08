import Link from "next/link";
import { requireUser } from "../../lib/auth";
import { ensureUserDefaults, invoiceBalance, sumPayments } from "../../lib/data";
import { formatCurrency, formatDate } from "../../lib/format";

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
  customers: { name: string } | null;
  payments: { amount: number | string | null }[] | null;
};

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  await ensureUserDefaults(supabase, user);
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id,invoice_number,status,issue_date,due_date,total_amount,customers(name),payments(amount)")
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
                <td>{formatCurrency(sumPayments(invoice.payments))}</td>
                <td>{formatCurrency(invoiceBalance(invoice))}</td>
                <td>
                  <span className="status-pill">{invoice.status.replace("_", " ")}</span>
                </td>
              </tr>
            ))}
            {(invoices ?? []).length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-cell">
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
