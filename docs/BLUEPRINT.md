# Wulfzx.underground Invoice Tracker Blueprint

## Purpose

The app is a private business dashboard for tracking what Wulfzx.underground sells, what clients owe, what has been paid, and what expenses or receipts need to be recorded.

## Main Sections

### 1. Dashboard

Shows a quick overview of business activity.

Recommended dashboard cards:

- Total sales
- Total received
- Outstanding balance
- Overdue invoices
- Monthly expenses
- Estimated net income

Dashboard tables:

- Recent invoices
- Recent payments
- Recent expenses

### 2. Customers / Clients

Manual client input fields:

- Client name
- Contact person
- Email
- Phone
- Address
- Notes

Each customer can be linked to multiple invoices.

### 3. Invoices

Manual invoice creation fields:

- Client
- Invoice number
- Issue date
- Due date
- Status
- Line items
- Discount
- Tax
- Notes
- Terms

Suggested statuses:

```txt
draft
sent
partially_paid
paid
overdue
cancelled
```

### 4. Invoice Line Items

Each invoice can have multiple billable items.

Fields:

- Description
- Quantity
- Unit price
- Line total

Line total formula:

```txt
line_total = quantity * unit_price
```

### 5. Payments Received

Records money actually received.

Fields:

- Invoice
- Payment date
- Amount
- Payment method
- Reference number
- Notes

Payment methods:

```txt
cash
bank_transfer
card
paypal
zelle
cash_app
check
other
```

### 6. Receipts / Expenses

Tracks business spending.

Fields:

- Vendor
- Category
- Expense date
- Amount
- Payment method
- Receipt file URL
- Notes

Starter categories:

- Software
- Hosting
- Marketing
- Equipment
- Contractors
- Office
- Travel
- Fees
- Other

### 7. Reports

Reports should answer:

- How much did Wulfzx.underground sell this month?
- How much money was actually received?
- Which invoices are still unpaid?
- Which invoices are overdue?
- How much was spent on expenses?
- What is the rough net income?

Recommended reports:

- Monthly sales
- Monthly payments received
- Monthly expenses
- Expenses by category
- Outstanding invoices
- Overdue invoices

## Core Calculations

### Invoice subtotal

```txt
subtotal = sum(invoice_items.line_total)
```

### Invoice total

```txt
total_amount = subtotal - discount_amount + tax_amount
```

### Amount received

```txt
amount_received = sum(payments.amount for invoice)
```

### Balance due

```txt
balance_due = total_amount - amount_received
```

### Estimated net income

```txt
estimated_net = total_received - total_expenses
```

## Status Logic

```txt
if invoice is manually saved but not sent:
    status = draft

if amount_received == 0 and due_date >= today:
    status = sent

if amount_received > 0 and amount_received < total_amount:
    status = partially_paid

if amount_received >= total_amount:
    status = paid

if amount_received < total_amount and due_date < today:
    status = overdue
```

## Version 1 Scope

Build first:

- Login
- Dashboard
- Customers
- Invoices
- Payments
- Receipts
- Reports

Save for version 2:

- Invoice PDF export
- Email invoice button
- Receipt image uploads
- Recurring invoices
- Tax reports
- Client portal
- Online payment links
