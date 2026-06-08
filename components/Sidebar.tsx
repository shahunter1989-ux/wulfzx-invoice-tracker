import { signOutAction } from "../app/actions";
import { getUserIfConfigured } from "../lib/auth";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/invoices", label: "Invoices" },
  { href: "/payments", label: "Payments" },
  { href: "/receipts", label: "Receipts" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" }
];

export async function Sidebar() {
  const { user } = await getUserIfConfigured();

  return (
    <aside style={{ borderRight: "1px solid var(--border)", padding: 24, background: "var(--surface)" }}>
      <h2 style={{ marginTop: 0 }}>Wulfzx</h2>
      <p className="muted">Invoice Tracker</p>
      <nav style={{ display: "grid", gap: 12, marginTop: 32 }}>
        {links.map((link) => (
          <a key={link.href} href={link.href} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)" }}>
            {link.label}
          </a>
        ))}
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
