import { signOutAction } from "../app/actions";
import { getUserIfConfigured } from "../lib/auth";
import { getWorkspaceIfConfigured } from "../lib/workspace";

const ownerLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/invoices", label: "Invoices" },
  { href: "/payments", label: "Payments" },
  { href: "/receipts", label: "Receipts" },
  { href: "/reports", label: "Reports" },
  { href: "/approvals", label: "Approvals" },
  { href: "/team", label: "Team" },
  { href: "/activity", label: "Activity" },
  { href: "/exports", label: "Exports" },
  { href: "/offline", label: "Offline Sync" },
  { href: "/settings", label: "Settings" },
  { href: "/about", label: "About / Install" }
];

const submitterLinks = [
  { href: "/submit", label: "Submit Work" },
  { href: "/offline", label: "Offline Sync" }
];

export async function Sidebar() {
  const { user } = await getUserIfConfigured();
  const workspace = user ? await getWorkspaceIfConfigured() : null;
  const links = user ? (workspace?.isSubmitter ? submitterLinks : ownerLinks) : [];

  return (
    <aside style={{ borderRight: "1px solid var(--border)", padding: 24, background: "var(--surface)" }}>
      <h2 style={{ marginTop: 0 }}>WZXU</h2>
      <p className="muted">Invoice Tracker</p>
      <nav style={{ display: "grid", gap: 12, marginTop: 32 }}>
        {links.map((link) => (
          <a key={link.href} href={link.href} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)" }}>
            {link.label}
          </a>
        ))}
        {!user ? (
          <a href="/login" style={{ padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)" }}>
            Login
          </a>
        ) : null}
      </nav>
      {user ? (
        <form action={signOutAction} style={{ marginTop: 32 }}>
          <button type="submit" className="secondary-button" style={{ width: "100%" }}>
            Logout
          </button>
        </form>
      ) : null}
    </aside>
  );
}
