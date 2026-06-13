import Link from "next/link";
import { ConfirmSubmitButton } from "../../components/ConfirmSubmitButton";
import { ensureUserDefaults } from "../../lib/data";
import { formatDate } from "../../lib/format";
import { requireOwner } from "../../lib/workspace";
import { deleteCustomerAction } from "../actions";

export const dynamic = "force-dynamic";

type CustomersPageProps = {
  searchParams: Promise<{ deleted?: string; error?: string; saved?: string }>;
};

type Customer = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

type InvoiceCustomer = {
  customer_id: string | null;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams;
  const { supabase, user, workspace } = await requireOwner();
  await ensureUserDefaults(supabase, user, workspace.id);
  const [{ data: customers }, { data: invoiceCustomers }] = await Promise.all([
    supabase.from("customers").select("id,name,contact_name,email,phone,created_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
    supabase.from("invoices").select("customer_id").eq("workspace_id", workspace.id).not("customer_id", "is", null)
  ]);

  const invoiceCounts = ((invoiceCustomers ?? []) as InvoiceCustomer[]).reduce<Record<string, number>>((counts, invoice) => {
    if (invoice.customer_id) {
      counts[invoice.customer_id] = (counts[invoice.customer_id] ?? 0) + 1;
    }
    return counts;
  }, {});

  const rows = ((customers ?? []) as Customer[]).map((customer) => ({
    ...customer,
    invoiceCount: invoiceCounts[customer.id] ?? 0
  }));

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

      {params.error ? <div className="notice error">{params.error}</div> : null}
      {params.saved ? <div className="notice success">Customer updated.</div> : null}
      {params.deleted ? <div className="notice success">Customer deleted.</div> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.name}</td>
                <td>{customer.contact_name || "-"}</td>
                <td>{customer.email || "-"}</td>
                <td>{customer.phone || "-"}</td>
                <td>{formatDate(customer.created_at.slice(0, 10))}</td>
                <td>
                  <div className="action-row">
                    <Link className="secondary-link compact-action" href={`/customers/${customer.id}/edit`}>
                      Edit
                    </Link>
                    {customer.invoiceCount === 0 ? (
                      <form action={deleteCustomerAction}>
                        <input type="hidden" name="customer_id" value={customer.id} />
                        <ConfirmSubmitButton className="secondary-button danger-button compact-action" confirmMessage={`Delete ${customer.name}? This cannot be undone.`}>
                          Delete
                        </ConfirmSubmitButton>
                      </form>
                    ) : (
                      <span className="muted small-note">Delete blocked: has invoices</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-cell">
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
