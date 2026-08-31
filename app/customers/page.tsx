import Link from "next/link";
import { ConfirmSubmitButton } from "../../components/ConfirmSubmitButton";
import { ensureUserDefaults } from "../../lib/data";
import { formatDate } from "../../lib/format";
import { requireOwner } from "../../lib/workspace";
import { deleteCustomerAction } from "../actions";

export const dynamic = "force-dynamic";

type CustomersPageProps = {
  searchParams: Promise<{ deleted?: string; error?: string; saved?: string; q?: string }>;
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
  const query = String(params.q ?? "").trim().toLowerCase();
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

  const rows = ((customers ?? []) as Customer[])
    .filter((customer) => {
      if (!query) return true;
      return [customer.name, customer.contact_name, customer.email, customer.phone].some((value) => String(value ?? "").toLowerCase().includes(query));
    })
    .map((customer) => ({
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

      <form className="filter-bar">
        <label>
          Search customers
          <input name="q" defaultValue={params.q ?? ""} placeholder="Name, contact, email, or phone" />
        </label>
        <button type="submit" className="secondary-button">
          Search
        </button>
        {params.q ? (
          <Link className="secondary-link" href="/customers">
            Clear
          </Link>
        ) : null}
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Invoices</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <Link href={`/customers/${customer.id}`}>{customer.name}</Link>
                </td>
                <td>{customer.contact_name || "-"}</td>
                <td>{customer.email || "-"}</td>
                <td>{customer.phone || "-"}</td>
                <td>{customer.invoiceCount}</td>
                <td>{formatDate(customer.created_at.slice(0, 10))}</td>
                <td>
                  <div className="action-row">
                    <Link className="secondary-link compact-action" href={`/customers/${customer.id}/edit`}>
                      Edit
                    </Link>
                    <Link className="secondary-link compact-action" href={`/customers/${customer.id}`}>
                      View
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
                  <td colSpan={7} className="empty-cell">
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
