import { INVOICE_TEMPLATES, normalizeInvoiceTemplate } from "../lib/invoiceTemplates";

type InvoiceTemplateSelectProps = {
  defaultValue?: string | null;
  label?: string;
};

export function InvoiceTemplateSelect({ defaultValue, label = "Invoice template" }: InvoiceTemplateSelectProps) {
  return (
    <label>
      {label}
      <select name="invoice_template" defaultValue={normalizeInvoiceTemplate(defaultValue)}>
        {INVOICE_TEMPLATES.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name}
          </option>
        ))}
      </select>
      <span className="field-hint">Choose the customer-facing design used for preview, print, and PDF.</span>
    </label>
  );
}
