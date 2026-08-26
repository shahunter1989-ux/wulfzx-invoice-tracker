import { INVOICE_TEMPLATES } from "../lib/invoiceTemplates";

export function InvoiceTemplatePreviewGrid() {
  return (
    <div className="template-preview-grid">
      {INVOICE_TEMPLATES.map((template) => (
        <div className={`template-preview-card template-preview-${template.id}`} key={template.id}>
          <div className="template-preview-paper">
            <span />
            <strong />
            <em />
          </div>
          <div>
            <strong>{template.name}</strong>
            <p>{template.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
