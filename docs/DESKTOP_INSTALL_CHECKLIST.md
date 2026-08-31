# WZXU Invoice Tracker Desktop Install Checklist

Use the hosted app as an installable web app first. This gives a desktop-style app without adding Electron, Tauri, or a separate local database.

## Install On Windows

1. Open `https://wulfzx-invoice-tracker.vercel.app` in Microsoft Edge or Google Chrome.
2. Sign in with the owner account.
3. Open the browser menu.
4. Choose **Apps > Install this site as an app** or **Install WZXU Invoice Tracker**.
5. Pin the installed app to the taskbar or Start menu.
6. Repeat these steps on the laptop or any other computer.

## How Data Works

- Supabase is the permanent database.
- Each computer sees the same synced customers, invoices, payments, expenses, and reports after login.
- Offline drafts are temporary and stay only on the device/browser where they were created.
- Reports update only after data is saved or synced to Supabase.

## Backup Routine

1. Open **Exports**.
2. Download Customers CSV, Invoices CSV, Payments CSV, Expenses CSV, and Submission Queue CSV.
3. Store backups somewhere private.
4. Repeat weekly or after heavy invoice work.

## Microsoft Store Later

Before Microsoft Store packaging, prepare:

- Stable app name and logo.
- App screenshots.
- Privacy policy.
- Support/contact page.
- QA pass for login, invoices, PDFs, payments, expenses, reports, exports, and offline drafts.
- Decision on PWA packaging versus a true desktop wrapper.
