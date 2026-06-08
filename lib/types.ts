export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "cancelled";

export type PaymentMethod = "cash" | "bank_transfer" | "card" | "paypal" | "zelle" | "cash_app" | "check" | "other";

export type InvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};
