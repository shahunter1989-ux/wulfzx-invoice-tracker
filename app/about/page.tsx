import Link from "next/link";
import { requireOwner } from "../../lib/workspace";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  await requireOwner();

  return (
    <section className="grid">
      <div className="page-header">
        <div>
          <h1>About / Install</h1>
          <p className="muted">Desktop-ready setup notes for WZXU Invoice Tracker.</p>
        </div>
        <Link className="secondary-link" href="/dashboard">
          Dashboard
        </Link>
      </div>

      <div className="grid grid-3">
        <section className="card">
          <h2>Install On Windows</h2>
          <ol className="instruction-list">
            <li>Open the live app in Microsoft Edge or Google Chrome.</li>
            <li>Sign in with the owner account.</li>
            <li>Open the browser menu and choose Install app or Apps &gt; Install this site as an app.</li>
            <li>Name it WZXU Invoice Tracker and pin it to the taskbar or Start menu.</li>
          </ol>
        </section>

        <section className="card">
          <h2>Offline Drafts</h2>
          <p className="muted">
            New customers, invoices, payments, and expenses can be saved as temporary drafts on this device if the internet drops after the app has loaded.
          </p>
          <p className="muted">
            Supabase remains the permanent database. Drafts do not update reports until they sync successfully.
          </p>
          <Link className="primary-link" href="/offline">
            Check Offline Drafts
          </Link>
        </section>

        <section className="card">
          <h2>Current Readiness</h2>
          <div className="mini-list">
            <div>
              <strong>Personal desktop use</strong>
              <span>Ready as an installed web app.</span>
            </div>
            <div>
              <strong>Multiple computers</strong>
              <span>Ready when each device signs in and has internet for synced records.</span>
            </div>
            <div>
              <strong>Microsoft Store</strong>
              <span>Not ready yet. Needs store assets, privacy page, QA, and packaging review.</span>
            </div>
          </div>
        </section>
      </div>

      <section className="card">
        <h2>Privacy And Backups</h2>
        <div className="grid grid-3">
          <div>
            <h3>Private Data</h3>
            <p className="muted">Business records are stored in Supabase and protected by login plus workspace permissions.</p>
          </div>
          <div>
            <h3>Device Drafts</h3>
            <p className="muted">Unsynced offline drafts live only in this browser. Clearing browser storage can remove them.</p>
          </div>
          <div>
            <h3>Exports</h3>
            <p className="muted">Use CSV exports regularly if you want local backups for customers, invoices, payments, expenses, and submissions.</p>
          </div>
        </div>
        <div className="action-row" style={{ marginTop: 16 }}>
          <Link className="primary-link" href="/exports">
            Open Exports
          </Link>
          <Link className="secondary-link" href="/settings">
            Open Settings
          </Link>
        </div>
      </section>
    </section>
  );
}
