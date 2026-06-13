import Link from "next/link";
import { requireOwner } from "../../lib/workspace";

export const dynamic = "force-dynamic";

const exports = [
  { href: "/api/exports/customers", label: "Customers CSV", description: "Customer names, contact details, and notes." },
  { href: "/api/exports/invoices", label: "Invoices CSV", description: "Invoice numbers, dates, status, totals, and customer names." },
  { href: "/api/exports/payments", label: "Payments CSV", description: "Payment dates, invoice numbers, methods, references, and amounts." },
  { href: "/api/exports/expenses", label: "Expenses CSV", description: "Expense dates, vendors, categories, methods, receipt URLs, and amounts." },
  { href: "/api/exports/submissions", label: "Submission Queue CSV", description: "Approval queue history for internal audit." }
];

export default async function ExportsPage() {
  await requireOwner();

  return (
    <section className="grid">
      <div className="page-header">
        <div>
          <h1>Exports</h1>
          <p className="muted">Owner-only CSV downloads for backups, bookkeeping, and audits.</p>
        </div>
      </div>
      <div className="grid grid-3">
        {exports.map((item) => (
          <div className="card" key={item.href}>
            <h2>{item.label}</h2>
            <p className="muted">{item.description}</p>
            <Link className="primary-link" href={item.href}>
              Download
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
