import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureUserDefaults, invoiceBalance, sumPayments } from "../../../lib/data";
import { formatCurrency, formatDate } from "../../../lib/format";
import { requireOwner } from "../../../lib/workspace";

export const dynamic = "force-dynamic";

type CustomerDetailPageProps = {
  params: Promise<{ id: string }>;
};

type Customer = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  total_amount: number | string;
  deposit_amount: number | string;
  payments: { amount: number | string | null }[] | null;
};

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;
  const { supabase, user, workspace } = await requireOwner();
  await ensureUserDefaults(supabase, user, workspace.id);

  const [{ data: customer }, { data: invoices }] = await Promise.all([
    supabase.from("customers").select("id,name,contact_name,email,phone,address,notes").eq("id", id).eq("workspace_id", workspace.id).single(),
    supabase
      .from("invoices")
      .select("id,invoice_number,status,issue_date,due_date,total_amount,deposit_amount,payments(amount)")
      .eq("customer_id", id)
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
  ]);

  if (!customer) notFound();

  const detail = customer as Customer;
  const invoiceRows = (invoices ?? []) as unknown as Invoice[];
  const totalBilled = invoiceRows.reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);
  const totalPaid = invoiceRows.reduce((sum, invoice) => sum + Number(invoice.deposit_amount ?? 0) + sumPayments(invoice.payments), 0);
  const outstanding = invoiceRows.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);

  return (
    <section className="grid">
      <div className="page-header">
        <div>
          <h1>{detail.name}</h1>
          <p className="muted">Customer details, invoice history, payments, and outstanding balance.</p>
        </div>
        <div className="action-row">
          <Link className="secondary-link" href="/customers">
            Back
          </Link>
          <Link className="primary-link" href={`/customers/${detail.id}/edit`}>
            Edit Customer
          </Link>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <p className="muted">Invoices</p>
          <h2>{invoiceRows.length}</h2>
        </div>
        <div className="card">
          <p className="muted">Total Billed</p>
          <h2>{formatCurrency(totalBilled)}</h2>
        </div>
        <div className="card">
          <p className="muted">Total Paid</p>
          <h2>{formatCurrency(totalPaid)}</h2>
        </div>
        <div className="card">
          <p className="muted">Outstanding</p>
          <h2>{formatCurrency(outstanding)}</h2>
        </div>
      </div>

      <div className="grid grid-3">
        <section className="card">
          <h2>Contact</h2>
          <div className="mini-list">
            <div>
              <strong>{detail.contact_name || "No contact person"}</strong>
              <span>{detail.email || "No email"}</span>
              <span>{detail.phone || "No phone"}</span>
            </div>
            <div>
              <strong>Address</strong>
              <span>{detail.address || "No address saved"}</span>
            </div>
            {detail.notes ? (
              <div>
                <strong>Notes</strong>
                <span>{detail.notes}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="card" style={{ gridColumn: "span 2" }}>
          <h2>Invoice History</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Issue</th>
                  <th>Due</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoiceRows.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <Link href={`/invoices/${invoice.id}`}>{invoice.invoice_number}</Link>
                    </td>
                    <td>{formatDate(invoice.issue_date)}</td>
                    <td>{formatDate(invoice.due_date)}</td>
                    <td>{formatCurrency(invoice.total_amount)}</td>
                    <td>{formatCurrency(Number(invoice.deposit_amount ?? 0) + sumPayments(invoice.payments))}</td>
                    <td>{formatCurrency(invoiceBalance(invoice))}</td>
                    <td>
                      <span className="status-pill">{invoice.status.replace("_", " ")}</span>
                    </td>
                  </tr>
                ))}
                {invoiceRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-cell">
                      No invoices for this customer yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
