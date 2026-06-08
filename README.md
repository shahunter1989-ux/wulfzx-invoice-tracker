# Wulfzx.underground Invoice Tracker

A private internal invoice, payment, receipt, and sales-tracking web app for **Wulfzx.underground**.

This repository is intended to become a private GitHub project. The app is designed for one owner/user first, with room to expand later.

## Core Goal

Track the financial flow of Wulfzx.underground:

- Customers / clients
- Sales invoices
- Payments received
- Receipt and expense records
- Outstanding balances
- Monthly reports

## Recommended Stack

- **Frontend / app framework:** Next.js
- **Database:** Supabase Postgres
- **Authentication:** Supabase Auth
- **Hosting:** Vercel
- **Code storage:** Private GitHub repository
- **Invoice prefix:** `WZX`

## Brand Defaults

```txt
Company name: Wulfzx.underground
Invoice prefix: WZX
Example invoice number: WZX-2026-0001
Default currency: USD
```

## App Pages

```txt
/login
/dashboard
/customers
/customers/new
/invoices
/invoices/new
/payments
/receipts
/reports
/settings
```

## First Build Milestone

Build the app in this order:

1. Login and protected dashboard
2. Customer/client records
3. Invoice creation
4. Invoice line items and totals
5. Payments received
6. Receipts/expenses
7. Reports and exports

## Important Security Rules

- Keep the GitHub repository private.
- Never commit `.env.local` or API secrets.
- Use Supabase Row Level Security.
- Only authenticated users should access app data.
- Export/back up business data regularly.

## Local Setup Notes

This is a starter blueprint and structure. After creating a real Next.js project, copy these files into the project and install dependencies.

Suggested command:

```bash
npx create-next-app@latest wulfzx-invoice-tracker
cd wulfzx-invoice-tracker
```

Then add Supabase and continue building from the included structure.

## Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `db/schema.sql`.
3. In Supabase Auth, create the owner email/password user.
4. Disable public signup for the owner-only version.
5. Add these environment variables locally and in Vercel:

```txt
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

After the variables are configured, sign in at `/login`, add a customer, create an invoice, then use the invoice detail page to print or download the invoice PDF.
