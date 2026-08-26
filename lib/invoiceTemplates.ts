export const DEFAULT_INVOICE_TEMPLATE = "professional_clean";

export const INVOICE_TEMPLATES = [
  {
    id: "professional_clean",
    name: "Professional Clean",
    description: "White document, restrained navy accents, best default for most customers."
  },
  {
    id: "luxury_black_gold",
    name: "Luxury Black Gold",
    description: "Premium black and gold styling for higher-end service work."
  },
  {
    id: "ai_tech_grid",
    name: "AI Tech Grid",
    description: "Dark blue and cyan technology style for AI, automation, apps, and software."
  },
  {
    id: "web_app_studio",
    name: "Web/App Studio",
    description: "Modern product studio layout for websites, apps, and design projects."
  },
  {
    id: "wulfzx_blueprint",
    name: "Wulfzx Blueprint",
    description: "Legacy boxed blue/yellow Wulfzx layout."
  }
] as const;

export type InvoiceTemplateId = (typeof INVOICE_TEMPLATES)[number]["id"];

const templateIds = new Set<string>(INVOICE_TEMPLATES.map((template) => template.id));

export function normalizeInvoiceTemplate(value: string | null | undefined): InvoiceTemplateId {
  return templateIds.has(String(value ?? "")) ? (value as InvoiceTemplateId) : DEFAULT_INVOICE_TEMPLATE;
}

export function getInvoiceTemplate(value: string | null | undefined) {
  const id = normalizeInvoiceTemplate(value);
  return INVOICE_TEMPLATES.find((template) => template.id === id) ?? INVOICE_TEMPLATES[0];
}
