import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDate } from "../../../../../lib/format";
import { invoiceBalance, sumPayments } from "../../../../../lib/data";
import { logAuditEvent } from "../../../../../lib/audit";
import { normalizeInvoiceTemplate, type InvoiceTemplateId } from "../../../../../lib/invoiceTemplates";
import { requireOwner } from "../../../../../lib/workspace";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type Invoice = {
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
    description: string;
    quantity: number | string;
    unit_price: number | string;
    line_total: number | string;
  }[];
  payments: {
    amount: number | string | null;
  }[];
};

type CompanySettings = {
  company_name: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
};

const BLUE = rgb(0.04, 0.22, 0.45);
const GOLD = rgb(0.96, 0.69, 0.08);
const CYAN = rgb(0.03, 0.72, 0.95);
const BLACK = rgb(0.05, 0.05, 0.06);
const GREEN = rgb(0.08, 0.42, 0.32);
const INK = rgb(0.08, 0.09, 0.12);
const MUTED = rgb(0.38, 0.43, 0.5);
const LIGHT_LINE = rgb(0.72, 0.78, 0.84);
const WHITE = rgb(1, 1, 1);
const SOFT = rgb(0.97, 0.98, 1);

type PdfTheme = {
  id: InvoiceTemplateId;
  primary: ReturnType<typeof rgb>;
  accent: ReturnType<typeof rgb>;
  heading: string;
  subheading: string;
  footer: string;
  darkHeader?: boolean;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, user, workspace } = await requireOwner();
  const [{ data: invoice }, { data: settings }] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "invoice_number,status,issue_date,due_date,invoice_template,subtotal,discount_amount,tax_amount,shipping_amount,deposit_amount,total_amount,ship_to_name,ship_to_address,ship_to_contact,payment_terms,notes,terms,customers(name,contact_name,email,phone,address),invoice_items(description,quantity,unit_price,line_total),payments(amount)"
      )
      .eq("id", id)
      .eq("workspace_id", workspace.id)
      .single(),
    supabase.from("company_settings").select("company_name,company_email,company_phone,company_address").eq("workspace_id", workspace.id).maybeSingle()
  ]);

  if (!invoice) {
    return new Response("Invoice not found", { status: 404 });
  }

  const detail = invoice as unknown as Invoice;
  const theme = getPdfTheme(detail.invoice_template);
  const company = settings as CompanySettings | null;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 28;
  const pageTop = 762;
  const pageWidth = 612;
  const contentWidth = pageWidth - margin * 2;
  const leftWidth = 304;
  const rightWidth = contentWidth - leftWidth - 18;
  const rightX = margin + leftWidth + 18;

  drawPageBorder(page, margin, theme);
  drawHero(page, bold, margin, pageTop, rightX, rightWidth, theme);
  drawCompanyPanel(page, font, bold, margin, 620, leftWidth, company, theme);
  drawFactsPanel(page, font, bold, rightX, 620, rightWidth, detail, theme);
  drawAddressPanel(page, font, bold, margin, 478, 262, "Bill To", [
    detail.customers?.name || "No customer",
    detail.customers?.contact_name,
    detail.customers?.address,
    detail.customers?.email,
    detail.customers?.phone
  ], theme);
  drawAddressPanel(page, font, bold, rightX, 478, rightWidth, "Ship To", [
    detail.ship_to_name || detail.customers?.name || "No customer",
    detail.ship_to_address || detail.customers?.address,
    detail.ship_to_contact || detail.customers?.contact_name || detail.customers?.email || detail.customers?.phone
  ], theme);
  drawItemsTable(page, font, bold, margin, 354, contentWidth, detail, theme);
  drawNotesPanel(page, font, bold, margin, 154, 274, detail, theme);
  drawTotalsPanel(page, font, bold, rightX, 154, rightWidth, detail, theme);
  drawFooter(page, font, bold, margin, contentWidth, theme);

  const bytes = await pdf.save();
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  await logAuditEvent(supabase, { workspaceId: workspace.id, actorId: user.id, action: "export_pdf", entityType: "invoice", entityId: id });
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${detail.invoice_number}.pdf"`
    }
  });
}

function drawHero(page: PDFPage, bold: PDFFont, x: number, top: number, rightX: number, rightWidth: number, theme: PdfTheme) {
  if (theme.darkHeader) {
    page.drawRectangle({ x: x - 8, y: top - 82, width: 556, height: 82, color: BLACK });
  }
  const titleColor = theme.darkHeader ? WHITE : theme.primary;
  drawText(page, "INVOICE", x + 18, top - 50, 54, bold, titleColor);
  page.drawRectangle({ x: x + 18, y: top - 68, width: 62, height: 5, color: theme.accent });
  page.drawRectangle({ x: x + 84, y: top - 67, width: 250, height: 3, color: titleColor });
  drawText(page, "WULFZX.UNDERGROUND", rightX, top - 24, 18, bold, titleColor);
  drawText(page, theme.subheading, rightX + 52, top - 44, 9, bold, theme.accent);
  page.drawEllipse({ x: rightX + rightWidth - 62, y: top - 57, xScale: 26, yScale: 26, borderColor: theme.accent, borderWidth: 5 });
  drawText(page, "WZX", rightX + rightWidth - 79, top - 65, 14, bold, titleColor);
}

function drawCompanyPanel(page: PDFPage, font: PDFFont, bold: PDFFont, x: number, y: number, width: number, settings: CompanySettings | null, theme: PdfTheme) {
  drawPanel(page, x, y, width, 96, theme);
  page.drawEllipse({ x: x + 66, y: y + 48, xScale: 32, yScale: 32, borderColor: theme.primary, borderWidth: 8 });
  drawText(page, "WZX", x + 45, y + 40, 14, bold, theme.primary);
  const lines = [
    settings?.company_name || "WULFZX.UNDERGROUND",
    settings?.company_address,
    settings?.company_phone ? `Phone: ${settings.company_phone}` : null,
    settings?.company_email ? `Email: ${settings.company_email}` : null
  ].filter(Boolean) as string[];
  drawText(page, lines[0].toUpperCase(), x + 130, y + 70, 13, bold, INK);
  lines.slice(1, 4).forEach((line, index) => drawText(page, line, x + 130, y + 50 - index * 14, 9, font, INK));
}

function drawFactsPanel(page: PDFPage, font: PDFFont, bold: PDFFont, x: number, y: number, width: number, detail: Invoice, theme: PdfTheme) {
  drawPanel(page, x, y, width, 96, theme);
  const facts = [
    ["Invoice #:", detail.invoice_number],
    ["Invoice date:", formatDate(detail.issue_date)],
    ["Due date:", formatDate(detail.due_date)],
    ["Payment terms:", detail.payment_terms || "Net 30"]
  ];
  facts.forEach(([label, value], index) => {
    const rowY = y + 72 - index * 22;
    if (index > 0) page.drawLine({ start: { x: x + 12, y: rowY + 11 }, end: { x: x + width - 12, y: rowY + 11 }, thickness: 0.5, color: LIGHT_LINE, dashArray: [2, 2] });
    drawText(page, label, x + 18, rowY, 9, bold, theme.primary);
    drawText(page, value, x + 112, rowY, 9, font, INK);
  });
}

function drawAddressPanel(page: PDFPage, font: PDFFont, bold: PDFFont, x: number, y: number, width: number, title: string, rawLines: Array<string | null | undefined>, theme: PdfTheme) {
  drawPanel(page, x, y, width, 112, theme);
  drawText(page, title.toUpperCase(), x + 16, y + 92, 13, bold, theme.primary);
  page.drawRectangle({ x: x + 106, y: y + 95, width: 34, height: 4, color: theme.accent });
  const lines = rawLines.filter(Boolean) as string[];
  lines.slice(0, 5).forEach((line, index) => drawText(page, line, x + 16, y + 70 - index * 14, index === 0 ? 10 : 9, index === 0 ? bold : font, INK));
}

function drawItemsTable(page: PDFPage, font: PDFFont, bold: PDFFont, x: number, y: number, width: number, detail: Invoice, theme: PdfTheme) {
  const height = 170;
  drawPanel(page, x, y, width, height, theme);
  const headerY = y + height - 24;
  const cols = [x, x + 318, x + 388, x + 466, x + width];
  page.drawLine({ start: { x, y: headerY }, end: { x: x + width, y: headerY }, thickness: 1, color: theme.primary });
  cols.slice(1, -1).forEach((colX) => page.drawLine({ start: { x: colX, y }, end: { x: colX, y: y + height }, thickness: 1, color: theme.primary }));
  drawText(page, "DESCRIPTION", x + 132, y + height - 17, 10, bold, theme.primary);
  drawText(page, "QTY", cols[1] + 22, y + height - 17, 10, bold, theme.primary);
  drawText(page, "RATE", cols[2] + 24, y + height - 17, 10, bold, theme.primary);
  drawText(page, "AMOUNT", cols[3] + 22, y + height - 17, 10, bold, theme.primary);

  detail.invoice_items.slice(0, 6).forEach((item, index) => {
    const rowY = headerY - 24 - index * 21;
    page.drawLine({ start: { x: x + 8, y: rowY - 7 }, end: { x: x + width - 8, y: rowY - 7 }, thickness: 0.4, color: LIGHT_LINE, dashArray: [2, 2] });
    drawText(page, truncate(item.description, 54), x + 12, rowY, 9, font, INK);
    drawText(page, Number(item.quantity).toFixed(2), cols[1] + 18, rowY, 9, font, INK);
    drawText(page, money(item.unit_price), cols[2] + 14, rowY, 9, font, INK);
    drawText(page, money(item.line_total), cols[3] + 18, rowY, 9, font, INK);
  });
}

function drawNotesPanel(page: PDFPage, font: PDFFont, bold: PDFFont, x: number, y: number, width: number, detail: Invoice, theme: PdfTheme) {
  drawPanel(page, x, y, width, 128, theme);
  drawText(page, "NOTES:", x + 14, y + 106, 12, bold, theme.primary);
  const note = detail.notes || detail.terms || "Thank you for your business. Payment is greatly appreciated.";
  wrapText(note, 42).slice(0, 5).forEach((line, index) => drawText(page, line, x + 14, y + 82 - index * 13, 9, font, INK));
  if (detail.notes && detail.terms) {
    wrapText(detail.terms, 42).slice(0, 3).forEach((line, index) => drawText(page, line, x + 14, y + 30 - index * 12, 8, font, MUTED));
  }
}

function drawTotalsPanel(page: PDFPage, font: PDFFont, bold: PDFFont, x: number, y: number, width: number, detail: Invoice, theme: PdfTheme) {
  drawPanel(page, x, y, width, 128, theme);
  const paymentTotal = sumPayments(detail.payments);
  const rows = [
    ["Subtotal:", money(detail.subtotal)],
    ["Tax:", money(detail.tax_amount)],
    ["Discount:", money(detail.discount_amount)],
    ["Shipping:", money(detail.shipping_amount ?? 0)],
    ["Deposit:", money(detail.deposit_amount ?? 0)],
    ["Paid:", money(paymentTotal)]
  ];
  rows.forEach(([label, value], index) => {
    const rowY = y + 106 - index * 15;
    page.drawLine({ start: { x: x + 10, y: rowY - 4 }, end: { x: x + width - 10, y: rowY - 4 }, thickness: 0.4, color: LIGHT_LINE, dashArray: [2, 2] });
    drawText(page, label, x + 12, rowY, 9, bold, INK);
    drawText(page, value, x + width - 62, rowY, 9, font, INK);
  });
  page.drawRectangle({ x, y, width, height: 34, borderColor: theme.accent, borderWidth: 1.5, color: SOFT });
  drawText(page, "TOTAL DUE:", x + 14, y + 10, 18, bold, theme.primary);
  drawText(page, money(invoiceBalance(detail)), x + width - 102, y + 8, 20, bold, theme.primary);
}

function drawFooter(page: PDFPage, font: PDFFont, bold: PDFFont, x: number, width: number, theme: PdfTheme) {
  page.drawLine({ start: { x, y: 44 }, end: { x: x + width, y: 44 }, thickness: 1, color: theme.primary });
  drawText(page, theme.footer, x + 216, 28, 10, bold, theme.primary);
  drawText(page, "WULFZX.UNDERGROUND", x + width - 136, 28, 8, bold, theme.primary);
  drawText(page, "invoice by wulfzx.underground", x + width - 130, 14, 8, font, MUTED);
}

function drawPageBorder(page: PDFPage, margin: number, theme: PdfTheme) {
  page.drawRectangle({ x: margin - 8, y: 18, width: 612 - margin * 2 + 16, height: 744, borderColor: theme.primary, borderWidth: 1.5 });
}

function drawPanel(page: PDFPage, x: number, y: number, width: number, height: number, theme: PdfTheme) {
  page.drawRectangle({ x, y, width, height, borderColor: theme.primary, borderWidth: 1.25, color: WHITE });
}

function getPdfTheme(value: string | null | undefined): PdfTheme {
  const id = normalizeInvoiceTemplate(value);
  if (id === "luxury_black_gold") {
    return { id, primary: BLACK, accent: GOLD, heading: "Luxury Black Gold", subheading: "PREMIUM SERVICES", footer: "THANK YOU", darkHeader: true };
  }
  if (id === "ai_tech_grid") {
    return { id, primary: BLUE, accent: CYAN, heading: "AI Tech Grid", subheading: "AI / APPS / AUTOMATION", footer: "SYSTEM COMPLETE" };
  }
  if (id === "web_app_studio") {
    return { id, primary: GREEN, accent: GOLD, heading: "Web/App Studio", subheading: "WEB / APP STUDIO", footer: "PROJECT DELIVERED" };
  }
  if (id === "wulfzx_blueprint") {
    return { id, primary: BLUE, accent: GOLD, heading: "Wulfzx Blueprint", subheading: "AI COMPANY", footer: "THANK YOU!" };
  }
  return { id, primary: BLUE, accent: rgb(0.35, 0.51, 0.72), heading: "Professional Clean", subheading: "PROFESSIONAL SERVICES", footer: "THANK YOU" };
}

function drawText(page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, color = INK) {
  page.drawText(sanitizePdfText(text), { x, y, size, font, color });
}

function money(value: number | string) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function truncate(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function wrapText(text: string, maxLength: number): string[] {
  const words = sanitizePdfText(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function sanitizePdfText(text: string) {
  return String(text ?? "").replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "");
}
