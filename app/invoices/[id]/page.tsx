import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteInvoiceAction, duplicateInvoiceAction, markInvoiceStatusAction, recordPaymentAction, updateInvoiceTemplateAction } from "../../actions";
import { ConfirmSubmitButton } from "../../../components/ConfirmSubmitButton";
import { InvoiceDocument } from "../../../components/InvoiceDocument";
import { InvoiceTemplateSelect } from "../../../components/InvoiceTemplateSelect";
import { OfflineForm } from "../../../components/OfflineForm";
import { PrintButton } from "../../../components/PrintButton";
import { ensureUserDefaults } from "../../../lib/data";
import { formatCurrency, formatDate } from "../../../lib/format";
import { getInvoiceTemplate } from "../../../lib/invoiceTemplates";
import { requireOwner } from "../../../lib/workspace";

export const dynamic = "force-dynamic";

type InvoiceDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  invoice_template: string | null;
  subtotal: number | string;
  discount_amount: number | string;
  tax_amount: number | string;
  shipping_amount: number | string;
  deposit_amount: number | string;
  total_amount: number | string;
  ship_to_name: string | null;
  ship_to_address: string | null;
  ship_to_contact: string | null;
  payment_terms: string | null;
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

type CompanySettings = {
  company_name: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
};

export default async function InvoiceDetailPage({ params, searchParams }: InvoiceDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, user, workspace } = await requireOwner();
  await ensureUserDefaults(supabase, user, workspace.id);

  const [{ data: invoice }, { data: settings }] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id,invoice_number,status,issue_date,due_date,invoice_template,subtotal,discount_amount,tax_amount,shipping_amount,deposit_amount,total_amount,ship_to_name,ship_to_address,ship_to_contact,payment_terms,notes,terms,customers(name,contact_name,email,phone,address),invoice_items(id,description,quantity,unit_price,line_total),payments(id,payment_date,amount,payment_method,reference_number)"
      )
      .eq("id", id)
      .eq("workspace_id", workspace.id)
      .single(),
    supabase.from("company_settings").select("company_name,company_email,company_phone,company_address").eq("workspace_id", workspace.id).maybeSingle()
  ]);

  if (!invoice) notFound();

  const detail = invoice as unknown as Invoice;
  const activeTemplate = getInvoiceTemplate(detail.invoice_template);

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
      {query.saved === "template" ? <div className="notice success no-print">Invoice template updated.</div> : null}
      {query.saved === "duplicated" ? <div className="notice success no-print">Duplicated invoice saved as a new draft.</div> : null}

      <div className="invoice-workspace">
        <InvoiceDocument detail={detail} company={settings as CompanySettings | null} />

        <aside className="card no-print">
          <h2>Invoice Actions</h2>
          <p className="muted">Current template: {activeTemplate.name}</p>
          <form action={updateInvoiceTemplateAction} className="grid form-grid">
            <input type="hidden" name="invoice_id" value={detail.id} />
            <InvoiceTemplateSelect defaultValue={detail.invoice_template} label="Change invoice template" />
            <button type="submit" className="secondary-button">
              Update Template
            </button>
          </form>
          <div className="action-row">
            <form action={duplicateInvoiceAction}>
              <input type="hidden" name="invoice_id" value={detail.id} />
              <button type="submit" className="secondary-button">
                Duplicate
              </button>
            </form>
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
          <OfflineForm action={recordPaymentAction} draftType="payment" className="grid form-grid">
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
          </OfflineForm>

          <h3>Payment History</h3>
          <div className="mini-list">
            {detail.payments.map((payment) => (
              <div key={payment.id}>
                <strong>{formatCurrency(payment.amount)}</strong>
                <span>
                  {formatDate(payment.payment_date)} - {payment.payment_method.replace("_", " ")}
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
