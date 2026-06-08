import Link from "next/link";
import { requireUser } from "../../lib/auth";
import { ensureUserDefaults } from "../../lib/data";
import { formatDate } from "../../lib/format";

export const dynamic = "force-dynamic";

type Customer = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export default async function CustomersPage() {
  const { supabase, user } = await requireUser();
  await ensureUserDefaults(supabase, user);
  const { data: customers } = await supabase.from("customers").select("id,name,contact_name,email,phone,created_at").order("created_at", { ascending: false });

  return (
    <section className="card">
      <div className="page-header">
        <div>
          <h1>Customers</h1>
          <p className="muted">Manual client/customer records used for invoices.</p>
        </div>
        <Link className="primary-link" href="/customers/new">
          New Customer
        </Link>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {((customers ?? []) as unknown as Customer[]).map((customer) => (
              <tr key={customer.id}>
                <td>{customer.name}</td>
                <td>{customer.contact_name || "—"}</td>
                <td>{customer.email || "—"}</td>
                <td>{customer.phone || "—"}</td>
                <td>{formatDate(customer.created_at.slice(0, 10))}</td>
              </tr>
            ))}
            {(customers ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-cell">
                  No customers yet. Add one before creating your first invoice.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
