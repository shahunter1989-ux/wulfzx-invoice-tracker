# WCHU Invoice Tracker Rebuild Prompt

Build a private business invoice tracker for WCHU. The app should prioritize the owner workflow first: customers, invoices, payments, expenses, reports, invoice PDFs, and fast daily use. Keep staff/team access as a secondary submit-only practice feature, not the primary workflow.

## Product Goal

Create a polished owner-only invoice and business tracking app for AI, websites, apps, automation, and digital service work. The app should feel practical, dark, modern, and business-focused. It should help the owner quickly create invoices, track payments, record expenses, review reports, and export records.

## Core Features

- Owner login with Supabase Auth.
- Private Supabase database scoped by workspace.
- Customer database with add, edit, search, detail view, and protected delete behavior.
- Invoice creation with line items, discount, tax, shipping, deposit, Ship To, notes, terms, payment terms, automatic invoice numbering, and per-invoice template selection.
- Invoice preview, print, and PDF download.
- Multiple invoice templates: Professional Clean, Luxury Black Gold, AI Tech Grid, Web/App Studio, and WCHU Blueprint legacy.
- Payment recording against invoices, including partial payments.
- Expense and receipt tracking with vendor, category, method, receipt URL, notes, edit, delete, and filters.
- Dashboard with unpaid balance, overdue invoices, paid this month, expenses this month, estimated net, pending approvals, and attention items.
- Reports calculated automatically from live database records.
- CSV exports for customers, invoices, payments, expenses, and submissions.
- Offline draft queue for new customers, invoices, payments, and expenses.
- Submit-only employee/intern access for practice and future use.

## Access Model

- Owner has full access to dashboard, records, reports, exports, settings, team, approvals, deletes, and PDFs.
- Employee and intern users are submit-only.
- Submit-only users can submit customers, invoices, payments, and expenses for owner review.
- Submit-only users cannot view dashboard totals, full history, reports, settings, exports, or official record lists.
- Owner approval is required before submitter work affects official records or reports.

## Technical Stack

- Next.js App Router.
- Supabase Auth and Postgres.
- Supabase RLS for owner/workspace scoping.
- Vercel production deployment.
- `pdf-lib` for invoice PDF generation.
- IndexedDB for temporary offline drafts.

## Design Direction

- Main app shell: dark WCHU style with subtle blue/tech branding.
- Work screens should be dense, clean, and practical rather than marketing-style.
- Invoice PDFs should be white or print-friendly, customer-facing, and readable.
- Keep WCHU branding uppercase on customer-facing invoice outputs.

## Future Improvements

- Email invoice sending.
- Logo upload and brand asset management.
- Better recurring invoices.
- Better customer statement export.
- Stronger profit/tax reporting.
- Proper multi-staff roles if the owner decides to actively use team access.
