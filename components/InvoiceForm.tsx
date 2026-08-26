"use client";

import { useMemo, useState } from "react";
import { createInvoiceAction } from "../app/actions";
import { calculateInvoiceTotal, calculateLineTotal, calculateSubtotal } from "../lib/calculations";
import { formatCurrency } from "../lib/format";
import { OfflineForm } from "./OfflineForm";

type CustomerOption = {
  id: string;
  name: string;
};

type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export function InvoiceForm({ customers }: { customers: CustomerOption[] }) {
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [deposit, setDeposit] = useState(0);

  const subtotal = useMemo(() => calculateSubtotal(items), [items]);
  const total = calculateInvoiceTotal(subtotal, discount, tax, shipping);
  const totalDue = Math.max(total - deposit, 0);

  function updateItem(index: number, key: keyof LineItem, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: key === "description" ? value : Number(value || 0)
            }
          : item
      )
    );
  }

  function addItem() {
    setItems((current) => [...current, { description: "", quantity: 1, unitPrice: 0 }]);
  }

  function removeItem(index: number) {
    setItems((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)));
  }

  return (
    <OfflineForm action={createInvoiceAction} draftType="invoice" className="grid form-grid">
      <label>
        Customer
        <select name="customer_id" required>
          <option value="">Select a customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
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
          <input name="ship_to_name" placeholder="Leave blank to use customer name" />
        </label>
        <label>
          Ship to contact
          <input name="ship_to_contact" placeholder="Email, phone, or contact person" />
        </label>
      </div>

      <label>
        Ship to address
        <textarea name="ship_to_address" rows={3} placeholder="Leave blank to use customer billing address" />
      </label>

      <div className="line-items">
        <div className="line-item-header">
          <h2>Line Items</h2>
          <button type="button" className="secondary-button" onClick={addItem}>
            Add Item
          </button>
        </div>
        {items.map((item, index) => (
          <div className="line-item-row" key={index}>
            <label>
              Description
              <input name="description" value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} required />
            </label>
            <label>
              Qty
              <input name="quantity" type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} required />
            </label>
            <label>
              Unit price
              <input name="unit_price" type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} required />
            </label>
            <div className="line-total">
              <span>Line total</span>
              <strong>{formatCurrency(calculateLineTotal(item.quantity, item.unitPrice))}</strong>
            </div>
            <button type="button" className="secondary-button danger-button" onClick={() => removeItem(index)} disabled={items.length === 1}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="two-column">
        <label>
          Discount amount
          <input name="discount_amount" type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(Number(event.target.value || 0))} />
        </label>
        <label>
          Tax amount
          <input name="tax_amount" type="number" min="0" step="0.01" value={tax} onChange={(event) => setTax(Number(event.target.value || 0))} />
        </label>
      </div>

      <div className="two-column">
        <label>
          Shipping amount
          <input name="shipping_amount" type="number" min="0" step="0.01" value={shipping} onChange={(event) => setShipping(Number(event.target.value || 0))} />
        </label>
        <label>
          Deposit amount
          <input name="deposit_amount" type="number" min="0" step="0.01" value={deposit} onChange={(event) => setDeposit(Number(event.target.value || 0))} />
        </label>
      </div>

      <div className="totals-panel">
        <div>
          <span>Subtotal</span>
          <strong>{formatCurrency(subtotal)}</strong>
        </div>
        <div>
          <span>Total</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
        <div>
          <span>Total due</span>
          <strong>{formatCurrency(totalDue)}</strong>
        </div>
      </div>

      <label>
        Notes
        <textarea name="notes" rows={3} />
      </label>
      <label>
        Payment terms
        <input name="payment_terms" defaultValue="Net 30" />
      </label>
      <label>
        Terms
        <textarea name="terms" rows={3} defaultValue="Payment is due by the listed due date. Thank you for your business." />
      </label>
      <button type="submit" disabled={customers.length === 0}>
        Save Invoice
      </button>
    </OfflineForm>
  );
}
