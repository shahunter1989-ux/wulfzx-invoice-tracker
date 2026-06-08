import type { InvoiceItem, InvoiceStatus } from "./types";

export function calculateLineTotal(quantity: number, unitPrice: number): number {
  return roundMoney(quantity * unitPrice);
}

export function calculateSubtotal(items: InvoiceItem[]): number {
  return roundMoney(items.reduce((sum, item) => sum + calculateLineTotal(item.quantity, item.unitPrice), 0));
}

export function calculateInvoiceTotal(subtotal: number, discountAmount = 0, taxAmount = 0): number {
  return roundMoney(subtotal - discountAmount + taxAmount);
}

export function calculateBalanceDue(totalAmount: number, amountReceived: number): number {
  return roundMoney(Math.max(totalAmount - amountReceived, 0));
}

export function calculateInvoiceStatus(params: {
  currentStatus?: InvoiceStatus;
  totalAmount: number;
  amountReceived: number;
  dueDate?: string | null;
  today?: Date;
}): InvoiceStatus {
  const { currentStatus, totalAmount, amountReceived, dueDate, today = new Date() } = params;

  if (currentStatus === "cancelled") return "cancelled";
  if (currentStatus === "draft") return "draft";
  if (amountReceived >= totalAmount && totalAmount > 0) return "paid";
  if (amountReceived > 0 && amountReceived < totalAmount) return "partially_paid";

  if (dueDate) {
    const due = new Date(`${dueDate}T00:00:00`);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (due < startOfToday && amountReceived < totalAmount) return "overdue";
  }

  return "sent";
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
