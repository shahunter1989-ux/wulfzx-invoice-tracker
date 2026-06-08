import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteInvoiceAction, markInvoiceStatusAction, recordPaymentAction } from "../../actions";
import { ConfirmSubmitButton } from "../../../components/ConfirmSubmitButton";
import { PrintButton } from "../../../components/PrintButton";
import { requireUser } from "../../../lib/auth";
import { ensureUserDefaults, invoiceBalance, sumPayments } from "../../../lib/data";
import { formatCurrency, formatDate } from "../../../lib/format";

export const dynamic = "force-dynamic";

type InvoiceDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number | string;
  discount_amount: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  notes: string | null;
  terms: string | null;
  customers: {
    name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  invoice_items: {
    id: string;
    description: string;
    quantity: number | string;
    unit_price: number | string;
    line_total: number | string;
  }[];
  payments: {
    id: string;
    payment_date: string;
    amount: number | string;
    payment_method: string;
    reference_number: string | null;
  }[];
};

export default async function InvoiceDetailPage({ params, searchParams }: InvoiceDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, user } = await requireUser();
  await ensureUserDefaults(supabase, user);

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id,invoice_number,status,issue_date,due_date,subtotal,discount_amount,tax_amount,total_amount,notes,terms,customers(name,contact_name,email,phone,address),invoice_items(id,description,quantity,unit_price,line_total),payments(id,payment_date,amount,payment_method,reference_number)"
    )
    .eq("id", id)
    .single();

  if (!invoice) notFound();

  const detail = invoice as unknown as Invoice;
  const paid = sumPayments(detail.payments);
  const balance = invoiceBalance(detail);

  return (
    <section className="invoice-detail">
      <div className="page-header no-print">
        <div>
          <h1>{detail.invoice_number}</h1>
          <p className="muted">Preview, print, download PDF, mark sent, or record a payment.</p>
        </div>
        <div className="action-row">
          <Link className="secondary-link" href="/invoices">
            Back
          </Link>
          <PrintButton />
          <a className="primary-link" href={`/api/invoices/${detail.id}/pdf`}>
            Download PDF
          </a>
        </div>
      </div>

      {query.error ? <div className="notice error no-print">{query.error}</div> : null}

      <div className="invoice-workspace">
        <article className="invoice-document">
          <header className="invoice-doc-header">
            <div>
              <h2>Wulfzx.underground</h2>
              <p>AI company</p>
            </div>
            <div className="invoice-meta">
              <strong>Invoice</strong>
              <span>{detail.invoice_number}</span>
              <span className="status-pill">{detail.status.replace("_", " ")}</span>
            </div>
          </header>

          <section className="invoice-doc-grid">
            <div>
              <span className="doc-label">Bill To</span>
              <h3>{detail.customers?.name || "No customer"}</h3>
              <p>{detail.customers?.contact_name}</p>
              <p>{detail.customers?.email}</p>
              <p>{detail.customers?.phone}</p>
              <p>{detail.customers?.address}</p>
            </div>
            <div>
              <span className="doc-label">Dates</span>
              <p>Issue: {formatDate(detail.issue_date)}</p>
              <p>Due: {formatDate(detail.due_date)}</p>
            </div>
          </section>

          <table className="invoice-lines">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {detail.invoice_items.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td>{Number(item.quantity).toFixed(2)}</td>
                  <td>{formatCurrency(item.unit_price)}</td>
                  <td>{formatCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="invoice-summary">
            <div>
              <span>Subtotal</span>
              <strong>{formatCurrency(detail.subtotal)}</strong>
            </div>
            <div>
              <span>Discount</span>
              <strong>{formatCurrency(detail.discount_amount)}</strong>
            </div>
            <div>
              <span>Tax</span>
              <strong>{formatCurrency(detail.tax_amount)}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatCurrency(detail.total_amount)}</strong>
            </div>
            <div>
              <span>Paid</span>
              <strong>{formatCurrency(paid)}</strong>
            </div>
            <div>
              <span>Balance</span>
              <strong>{formatCurrency(balance)}</strong>
            </div>
          </section>

          {detail.notes ? (
            <section>
              <span className="doc-label">Notes</span>
              <p>{detail.notes}</p>
            </section>
          ) : null}
          {detail.terms ? (
            <section>
              <span className="doc-label">Terms</span>
              <p>{detail.terms}</p>
            </section>
          ) : null}
        </article>

        <aside className="card no-print">
          <h2>Invoice Actions</h2>
          <div className="action-row">
            <form action={markInvoiceStatusAction}>
              <input type="hidden" name="invoice_id" value={detail.id} />
              <input type="hidden" name="status" value="sent" />
              <button type="submit" className="secondary-button">
                Mark Sent
              </button>
            </form>
            <form action={markInvoiceStatusAction}>
              <input type="hidden" name="invoice_id" value={detail.id} />
              <input type="hidden" name="status" value="cancelled" />
              <button type="submit" className="secondary-button danger-button">
                Cancel
              </button>
            </form>
          </div>

          <div className="danger-zone">
            <h3>Remove Invoice</h3>
            <p className="muted">Deleting this invoice also removes its line items and payment history.</p>
            <form action={deleteInvoiceAction}>
              <input type="hidden" name="invoice_id" value={detail.id} />
              <ConfirmSubmitButton className="secondary-button danger-button" confirmMessage={`Delete invoice ${detail.invoice_number}? This cannot be undone.`}>
                Delete Invoice
              </ConfirmSubmitButton>
            </form>
          </div>

          <h3>Record Payment</h3>
          <form action={recordPaymentAction} className="grid form-grid">
            <input type="hidden" name="invoice_id" value={detail.id} />
            <label>
              Payment date
              <input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </label>
            <label>
              Amount
              <input name="amount" type="number" min="0" step="0.01" required />
            </label>
            <label>
              Method
              <select name="payment_method" defaultValue="other">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="card">Card</option>
                <option value="paypal">PayPal</option>
                <option value="zelle">Zelle</option>
                <option value="cash_app">Cash App</option>
                <option value="check">Check</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Reference
              <input name="reference_number" />
            </label>
            <label>
              Notes
              <textarea name="notes" rows={3} />
            </label>
            <button type="submit">Save Payment</button>
          </form>

          <h3>Payment History</h3>
          <div className="mini-list">
            {detail.payments.map((payment) => (
              <div key={payment.id}>
                <strong>{formatCurrency(payment.amount)}</strong>
                <span>
                  {formatDate(payment.payment_date)} · {payment.payment_method.replace("_", " ")}
                </span>
              </div>
            ))}
            {detail.payments.length === 0 ? <p className="muted">No payments recorded.</p> : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
