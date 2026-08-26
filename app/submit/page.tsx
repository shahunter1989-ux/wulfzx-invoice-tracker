import { OfflineForm } from "../../components/OfflineForm";
import { DEFAULT_EXPENSE_CATEGORIES } from "../../lib/data";
import { formatCurrency, formatDate } from "../../lib/format";
import { requireWorkspace } from "../../lib/workspace";
import { submitCustomerSubmissionAction, submitExpenseSubmissionAction, submitInvoiceSubmissionAction, submitPaymentSubmissionAction } from "../actions";

export const dynamic = "force-dynamic";

type SubmitPageProps = {
  searchParams: Promise<{ error?: string; submitted?: string }>;
};

type CustomerPicker = {
  id: string;
  name: string;
  contact_label: string | null;
};

type InvoicePicker = {
  id: string;
  invoice_number: string;
  customer_name: string;
  status: string;
  balance_due: number | string;
};

type SubmissionRow = {
  id: string;
  submission_type: string;
  status: string;
  review_note: string | null;
  created_at: string;
};

export default async function SubmitPage({ searchParams }: SubmitPageProps) {
  const params = await searchParams;
  const { supabase, user, workspace, role } = await requireWorkspace();

  const [{ data: customers }, { data: invoices }, { data: submissions }] = await Promise.all([
    supabase.rpc("workspace_customer_picker", { p_workspace_id: workspace.id }),
    supabase.rpc("workspace_invoice_picker", { p_workspace_id: workspace.id }),
    supabase
      .from("submission_queue")
      .select("id,submission_type,status,review_note,created_at")
      .eq("submitted_by", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  const customerOptions = (customers ?? []) as CustomerPicker[];
  const invoiceOptions = (invoices ?? []) as InvoicePicker[];
  const submissionRows = (submissions ?? []) as SubmissionRow[];

  return (
    <section className="grid">
      <div className="page-header">
        <div>
          <h1>Submit Work</h1>
          <p className="muted">
            {role === "owner" ? "Owner submission view for testing." : "Submit customer, invoice, payment, and expense details for owner review."}
          </p>
        </div>
        <span className="status-pill">{role}</span>
      </div>

      {params.error ? <div className="notice error">{params.error}</div> : null}
      {params.submitted ? <div className="notice success">Submitted for owner review. Reports update only after approval.</div> : null}
      <div className="notice warning">
        Submitted records are not official until the owner approves them. Offline drafts stay on this device until sync sends them to the approval queue.
      </div>

      <div className="grid grid-3">
        <section className="card">
          <h2>Submit Customer</h2>
          <OfflineForm action={submitCustomerSubmissionAction} draftType="customer" className="grid form-grid">
            <label>
              Customer name
              <input name="name" required />
            </label>
            <label>
              Contact person
              <input name="contact_name" />
            </label>
            <label>
              Email
              <input name="email" type="email" />
            </label>
            <label>
              Phone
              <input name="phone" />
            </label>
            <label>
              Address
              <textarea name="address" rows={3} />
            </label>
            <label>
              Notes
              <textarea name="notes" rows={3} />
            </label>
            <button type="submit">Submit Customer</button>
          </OfflineForm>
        </section>

        <section className="card">
          <h2>Submit Invoice</h2>
          <OfflineForm action={submitInvoiceSubmissionAction} draftType="invoice" className="grid form-grid">
            <label>
              Customer
              <select name="customer_id" required>
                <option value="">Select customer</option>
                {customerOptions.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.contact_label ? ` - ${customer.contact_label}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="two-column">
              <label>
                Issue date
                <input name="issue_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
              </label>
              <label>
                Due date
                <input name="due_date" type="date" />
              </label>
            </div>
            <div className="two-column">
              <label>
                Ship to name
                <input name="ship_to_name" placeholder="Leave blank to use customer" />
              </label>
              <label>
                Ship to contact
                <input name="ship_to_contact" />
              </label>
            </div>
            <label>
              Ship to address
              <textarea name="ship_to_address" rows={3} />
            </label>
            {[0, 1, 2].map((index) => (
              <div className="line-item-row" key={index}>
                <label>
                  Description
                  <input name="description" required={index === 0} />
                </label>
                <label>
                  Qty
                  <input name="quantity" type="number" min="0" step="0.01" defaultValue={index === 0 ? 1 : undefined} required={index === 0} />
                </label>
                <label>
                  Unit price
                  <input name="unit_price" type="number" min="0" step="0.01" required={index === 0} />
                </label>
              </div>
            ))}
            <div className="two-column">
              <label>
                Discount amount
                <input name="discount_amount" type="number" min="0" step="0.01" />
              </label>
              <label>
                Tax amount
                <input name="tax_amount" type="number" min="0" step="0.01" />
              </label>
            </div>
            <div className="two-column">
              <label>
                Shipping amount
                <input name="shipping_amount" type="number" min="0" step="0.01" />
              </label>
              <label>
                Deposit amount
                <input name="deposit_amount" type="number" min="0" step="0.01" />
              </label>
            </div>
            <label>
              Payment terms
              <input name="payment_terms" defaultValue="Net 30" />
            </label>
            <label>
              Notes
              <textarea name="notes" rows={3} />
            </label>
            <label>
              Terms
              <textarea name="terms" rows={3} defaultValue="Payment is due by the listed due date." />
            </label>
            <button type="submit" disabled={customerOptions.length === 0}>
              Submit Invoice
            </button>
          </OfflineForm>
        </section>

        <section className="card">
          <h2>Submit Payment Received</h2>
          <OfflineForm action={submitPaymentSubmissionAction} draftType="payment" className="grid form-grid">
            <label>
              Invoice
              <select name="invoice_id" required>
                <option value="">Select invoice</option>
                {invoiceOptions.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} - {invoice.customer_name} - Balance {formatCurrency(invoice.balance_due)}
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
            <button type="submit" disabled={invoiceOptions.length === 0}>
              Submit Payment
            </button>
          </OfflineForm>
        </section>

        <section className="card">
          <h2>Submit Expense / Receipt</h2>
          <OfflineForm action={submitExpenseSubmissionAction} draftType="expense" className="grid form-grid">
            <div className="two-column">
              <label>
                Vendor
                <input name="vendor" />
              </label>
              <label>
                Category
                <select name="category_name" defaultValue="Other">
                  {DEFAULT_EXPENSE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="two-column">
              <label>
                Expense date
                <input name="expense_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
              </label>
              <label>
                Amount
                <input name="amount" type="number" min="0" step="0.01" required />
              </label>
            </div>
            <div className="two-column">
              <label>
                Payment method
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
                Receipt URL
                <input name="receipt_url" type="url" placeholder="https://..." />
              </label>
            </div>
            <label>
              Notes
              <textarea name="notes" rows={3} />
            </label>
            <button type="submit">Submit Expense</button>
          </OfflineForm>
        </section>

        <section className="card">
          <h2>My Submissions</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Submitted</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Owner note</th>
                </tr>
              </thead>
              <tbody>
                {submissionRows.map((submission) => (
                  <tr key={submission.id}>
                    <td>{formatDate(submission.created_at.slice(0, 10))}</td>
                    <td>{submission.submission_type}</td>
                    <td>
                      <span className="status-pill">{submission.status.replace("_", " ")}</span>
                    </td>
                    <td>{submission.review_note || "-"}</td>
                  </tr>
                ))}
                {submissionRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-cell">
                      No submissions yet.
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
