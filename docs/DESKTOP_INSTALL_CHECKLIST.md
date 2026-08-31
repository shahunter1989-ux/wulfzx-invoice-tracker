# WZXU Invoice Tracker Desktop Install Checklist

Use the hosted app as an installable web app first. This gives a desktop-style app without adding Electron, Tauri, or a separate local database.

## Install On Windows

1. Open `https://wulfzx-invoice-tracker.vercel.app` in Microsoft Edge or Google Chrome.
2. Sign in with the owner account.
3. In Microsoft Edge, open **Settings and more > Apps > Install this site as an app**.
4. In Google Chrome, open **Customize and control Google Chrome > Cast, save, and share > Install page as app**.
5. Use the name **WZXU Invoice Tracker**.
6. Pin the installed app to the taskbar or Start menu.
7. Repeat these steps on the laptop or any other computer.

## Updating The Installed App

1. Keep using `https://wulfzx-invoice-tracker.vercel.app`; the installed app points to the same production site.
2. After a deployment, close and reopen the installed app.
3. If a screen still looks old, press **Ctrl+R** once inside the installed app.
4. Use the same owner login on every computer.

## How Data Works

- Supabase is the permanent database.
- Each computer sees the same synced customers, invoices, payments, expenses, and reports after login.
- Offline drafts are temporary and stay only on the device/browser where they were created.
- Reports update only after data is saved or synced to Supabase.
- Clearing browser storage, resetting the app, or uninstalling the browser profile can remove unsynced drafts.

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
