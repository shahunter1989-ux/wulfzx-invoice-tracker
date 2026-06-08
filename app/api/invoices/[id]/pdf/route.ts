import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireUser } from "../../../../../lib/auth";
import { formatDate } from "../../../../../lib/format";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type Invoice = {
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
    description: string;
    quantity: number | string;
    unit_price: number | string;
    line_total: number | string;
  }[];
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase } = await requireUser();
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "invoice_number,status,issue_date,due_date,subtotal,discount_amount,tax_amount,total_amount,notes,terms,customers(name,contact_name,email,phone,address),invoice_items(description,quantity,unit_price,line_total)"
    )
    .eq("id", id)
    .single();

  if (!invoice) {
    return new Response("Invoice not found", { status: 404 });
  }

  const detail = invoice as unknown as Invoice;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  let y = 742;

  function draw(text: string, x: number, size = 10, useBold = false) {
    page.drawText(text, { x, y, size, font: useBold ? bold : font, color: rgb(0.08, 0.08, 0.1) });
  }

  function money(value: number | string) {
    return `$${Number(value ?? 0).toFixed(2)}`;
  }

  draw("Wulfzx.underground", margin, 18, true);
  y -= 22;
  draw("AI company", margin, 10);
  y = 742;
  draw("INVOICE", 430, 18, true);
  y -= 22;
  draw(detail.invoice_number, 430, 11);
  y -= 16;
  draw(detail.status.replace("_", " ").toUpperCase(), 430, 9, true);

  y = 670;
  draw("Bill To", margin, 10, true);
  y -= 18;
  draw(detail.customers?.name || "No customer", margin, 12, true);
  for (const line of [detail.customers?.contact_name, detail.customers?.email, detail.customers?.phone, detail.customers?.address].filter(Boolean)) {
    y -= 15;
    draw(String(line), margin, 10);
  }

  y = 670;
  draw(`Issue: ${formatDate(detail.issue_date)}`, 360, 10);
  y -= 16;
  draw(`Due: ${formatDate(detail.due_date)}`, 360, 10);

  y = 570;
  page.drawLine({ start: { x: margin, y }, end: { x: 564, y }, thickness: 1, color: rgb(0.75, 0.75, 0.78) });
  y -= 22;
  draw("Description", margin, 10, true);
  draw("Qty", 350, 10, true);
  draw("Unit", 410, 10, true);
  draw("Total", 500, 10, true);
  y -= 14;
  page.drawLine({ start: { x: margin, y }, end: { x: 564, y }, thickness: 1, color: rgb(0.85, 0.85, 0.88) });
  y -= 20;

  for (const item of detail.invoice_items) {
    const descriptionLines = wrapText(item.description, 48);
    draw(descriptionLines[0] || "", margin, 10);
    draw(Number(item.quantity).toFixed(2), 350, 10);
    draw(money(item.unit_price), 410, 10);
    draw(money(item.line_total), 500, 10);
    for (const extraLine of descriptionLines.slice(1)) {
      y -= 14;
      draw(extraLine, margin, 10);
    }
    y -= 22;
  }

  y -= 10;
  const totalsX = 390;
  const amountX = 500;
  draw("Subtotal", totalsX, 10);
  draw(money(detail.subtotal), amountX, 10);
  y -= 16;
  draw("Discount", totalsX, 10);
  draw(money(detail.discount_amount), amountX, 10);
  y -= 16;
  draw("Tax", totalsX, 10);
  draw(money(detail.tax_amount), amountX, 10);
  y -= 20;
  draw("Total", totalsX, 12, true);
  draw(money(detail.total_amount), amountX, 12, true);

  y -= 46;
  if (detail.notes) {
    draw("Notes", margin, 10, true);
    y -= 15;
    for (const line of wrapText(detail.notes, 86)) {
      draw(line, margin, 9);
      y -= 12;
    }
  }

  if (detail.terms) {
    y -= 8;
    draw("Terms", margin, 10, true);
    y -= 15;
    for (const line of wrapText(detail.terms, 86)) {
      draw(line, margin, 9);
      y -= 12;
    }
  }

  const bytes = await pdf.save();
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${detail.invoice_number}.pdf"`
    }
  });
}

function wrapText(text: string, maxLength: number): string[] {
  const words = text.split(/\s+/);
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
