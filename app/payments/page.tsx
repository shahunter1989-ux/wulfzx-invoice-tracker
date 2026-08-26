import Link from "next/link";
import { OfflineForm } from "../../components/OfflineForm";
import { recordPaymentAction } from "../actions";
import { ensureUserDefaults, invoiceBalance } from "../../lib/data";
import { formatCurrency, formatDate } from "../../lib/format";
import { requireOwner } from "../../lib/workspace";

export const dynamic = "force-dynamic";

type PaymentsPageProps = {
  searchParams: Promise<{ error?: string; method?: string; q?: string; from?: string; to?: string }>;
};

type InvoiceOption = {
  id: string;
  invoice_number: string;
  total_amount: number | string;
  deposit_amount: number | string;
  customers: { name: string } | null;
  payments: { amount: number | string | null }[] | null;
};

type PaymentRow = {
  id: string;
  payment_date: string;
  amount: number | string;
  payment_method: string;
  reference_number: string | null;
  invoices: { id: string; invoice_number: string; customers: { name: string } | null } | null;
};

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const params = await searchParams;
  const { supabase, user, workspace } = await requireOwner();
  await ensureUserDefaults(supabase, user, workspace.id);
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id,invoice_number,total_amount,deposit_amount,customers(name),payments(amount)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });
  const { data: payments } = await supabase
    .from("payments")
    .select("id,payment_date,amount,payment_method,reference_number,invoices(id,invoice_number,customers(name))")
    .eq("workspace_id", workspace.id)
    .order("payment_date", { ascending: false });

  const paymentRows = ((payments ?? []) as unknown as PaymentRow[]).filter((payment) => {
    const query = String(params.q ?? "").trim().toLowerCase();
    const matchesQuery = !query || [payment.invoices?.invoice_number, payment.invoices?.customers?.name, payment.reference_number].some((value) => String(value ?? "").toLowerCase().includes(query));
    const matchesMethod = !params.method || payment.payment_method === params.method;
    const matchesFrom = !params.from || payment.payment_date >= params.from;
    const matchesTo = !params.to || payment.payment_date <= params.to;
    return matchesQuery && matchesMethod && matchesFrom && matchesTo;
  });
  const monthStartText = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const paidThisMonth = ((payments ?? []) as unknown as PaymentRow[]).filter((payment) => payment.payment_date >= monthStartText).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const filteredTotal = paymentRows.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

  return (
    <section className="grid">
      <div className="card">
        <h1>Payments Received</h1>
        <p className="muted">Track money received against invoices, including partial payments.</p>
        {params.error ? <div className="notice error">{params.error}</div> : null}
        <OfflineForm action={recordPaymentAction} draftType="payment" className="grid form-grid">
          <label>
            Invoice
            <select name="invoice_id" required>
              <option value="">Select invoice</option>
              {((invoices ?? []) as unknown as InvoiceOption[]).map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_number} - {invoice.customers?.name || "No customer"} - Balance {formatCurrency(invoiceBalance(invoice))}
                </option>
              ))}
            </select>
          </label>
          <div className="two-column">
            <label>
              Payment date
              <input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </label>
            <label>
              Amount
              <input name="amount" type="number" min="0" step="0.01" required />
            </label>
          </div>
          <div className="two-column">
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
          </div>
          <label>
            Notes
            <textarea name="notes" rows={3} />
          </label>
          <button type="submit">Save Payment</button>
        </OfflineForm>
      </div>

      <div className="card">
        <div className="page-header">
          <div>
            <h2>Recent Payments</h2>
            <p className="muted">
              This month: {formatCurrency(paidThisMonth)} | Filtered total: {formatCurrency(filteredTotal)}
            </p>
          </div>
        </div>
        <form className="filter-bar">
          <label>
            Search
            <input name="q" defaultValue={params.q ?? ""} placeholder="Invoice, client, or reference" />
          </label>
          <label>
            Method
            <select name="method" defaultValue={params.method ?? ""}>
              <option value="">All methods</option>
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
          <div className="action-row">
            <button type="submit" className="secondary-button compact-action">
              Filter
            </button>
            <Link className="secondary-link compact-action" href="/payments">
              Clear
            </Link>
          </div>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Client</th>
                <th>Amount</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              {paymentRows.map((payment) => (
                <tr key={payment.id}>
                  <td>{formatDate(payment.payment_date)}</td>
                  <td>{payment.invoices ? <Link href={`/invoices/${payment.invoices.id}`}>{payment.invoices.invoice_number}</Link> : "-"}</td>
                  <td>{payment.invoices?.customers?.name || "-"}</td>
                  <td>{formatCurrency(payment.amount)}</td>
                  <td>{payment.payment_method.replace("_", " ")}</td>
                </tr>
              ))}
              {paymentRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    No payments recorded yet.
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
