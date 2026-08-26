import { invoiceBalance, sumPayments } from "../lib/data";
import { formatCurrency, formatDate } from "../lib/format";
import { normalizeInvoiceTemplate, type InvoiceTemplateId } from "../lib/invoiceTemplates";

export type InvoiceDocumentData = {
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  invoice_template?: string | null;
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
    id?: string;
    description: string;
    quantity: number | string;
    unit_price: number | string;
    line_total: number | string;
  }[];
  payments: {
    amount: number | string | null;
  }[];
};

type InvoiceDocumentProps = {
  detail: InvoiceDocumentData;
  company?: {
    company_name: string | null;
    company_email: string | null;
    company_phone: string | null;
    company_address: string | null;
  } | null;
};

export function InvoiceDocument({ detail, company }: InvoiceDocumentProps) {
  const templateId = normalizeInvoiceTemplate(detail.invoice_template);
  const templateClass = `invoice-template invoice-template-${templateId}`;
  const paymentTotal = sumPayments(detail.payments);
  const balance = invoiceBalance(detail);
  const billToLines = [detail.customers?.contact_name, detail.customers?.address, detail.customers?.email, detail.customers?.phone].filter(Boolean);
  const shipToLines = [
    detail.ship_to_address || detail.customers?.address,
    detail.ship_to_contact || detail.customers?.contact_name || detail.customers?.email || detail.customers?.phone
  ].filter(Boolean);
  const companyName = company?.company_name || "WZXU";
  const companyLines = [company?.company_address, company?.company_phone ? `Phone: ${company.company_phone}` : null, company?.company_email ? `Email: ${company.company_email}` : null].filter(
    Boolean
  );

  return (
    <article className={templateClass}>
      <header className="invoice-template-header">
        <div>
          <p className="invoice-kicker">Invoice</p>
          <h2>INVOICE</h2>
          <p className="invoice-brand">{companyName}</p>
        </div>
        <div className="invoice-template-badge">
          <strong>WZXU</strong>
          <span>{detail.status.replace("_", " ")}</span>
        </div>
      </header>

      <section className="invoice-template-grid invoice-template-top">
        <div className="invoice-template-panel company-panel">
          <h3>{companyName}</h3>
          {companyLines.map((line) => (
            <p key={String(line)}>{line}</p>
          ))}
          {companyLines.length === 0 ? <p>AI, websites, apps, and automation services.</p> : null}
        </div>
        <div className="invoice-template-panel invoice-facts">
          <div>
            <strong>Invoice #</strong>
            <span>{detail.invoice_number}</span>
          </div>
          <div>
            <strong>Invoice date</strong>
            <span>{formatDate(detail.issue_date)}</span>
          </div>
          <div>
            <strong>Due date</strong>
            <span>{formatDate(detail.due_date)}</span>
          </div>
          <div>
            <strong>Payment terms</strong>
            <span>{detail.payment_terms || "Net 30"}</span>
          </div>
        </div>
      </section>

      <section className="invoice-template-grid">
        <AddressPanel title="Bill To" name={detail.customers?.name || "No customer"} lines={billToLines} />
        <AddressPanel title="Ship To" name={detail.ship_to_name || detail.customers?.name || "No customer"} lines={shipToLines} />
      </section>

      <table className="invoice-lines template-lines">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {detail.invoice_items.map((item, index) => (
            <tr key={item.id ?? `${item.description}-${index}`}>
              <td>{item.description}</td>
              <td>{Number(item.quantity).toFixed(2)}</td>
              <td>{formatCurrency(item.unit_price)}</td>
              <td>{formatCurrency(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="invoice-template-grid invoice-template-bottom">
        <div className="invoice-template-panel notes-panel">
          <h3>Notes</h3>
          <p>{detail.notes || detail.terms || "Thank you for your business. Payment is greatly appreciated."}</p>
          {detail.notes && detail.terms ? <p>{detail.terms}</p> : null}
        </div>
        <div className="invoice-template-panel template-totals">
          <TotalRow label="Subtotal" value={detail.subtotal} />
          <TotalRow label="Tax" value={detail.tax_amount} />
          <TotalRow label="Discount" value={detail.discount_amount} />
          <TotalRow label="Shipping" value={detail.shipping_amount ?? 0} />
          <TotalRow label="Deposit" value={detail.deposit_amount ?? 0} />
          <TotalRow label="Paid" value={paymentTotal} />
          <div className="template-total-due">
            <span>Total Due</span>
            <strong>{formatCurrency(balance)}</strong>
          </div>
        </div>
      </section>

      <footer className="invoice-template-footer">
        <span>Thank you for your business.</span>
        <strong>WZXU</strong>
      </footer>
    </article>
  );
}

function AddressPanel({ title, name, lines }: { title: string; name: string; lines: (string | null | undefined)[] }) {
  return (
    <div className="invoice-template-panel address-panel">
      <span className="invoice-section-label">{title}</span>
      <h3>{name}</h3>
      {lines.filter(Boolean).map((line) => (
        <p key={String(line)}>{line}</p>
      ))}
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{formatCurrency(value)}</strong>
    </div>
  );
}
