import Link from "next/link";
import { createCustomerAction } from "../../actions";

export const dynamic = "force-dynamic";

type NewCustomerPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewCustomerPage({ searchParams }: NewCustomerPageProps) {
  const params = await searchParams;

  return (
    <section className="card narrow-card">
      <div className="page-header">
        <div>
          <h1>New Customer</h1>
          <p className="muted">Create a customer/client record before making invoices.</p>
        </div>
        <Link className="secondary-link" href="/customers">
          Back to customers
        </Link>
      </div>

      {params.error ? <div className="notice error">{params.error}</div> : null}

      <form action={createCustomerAction} className="grid form-grid">
        <label>
          Customer or client name
          <input name="name" required />
        </label>
        <label>
          Contact name
          <input name="contact_name" />
        </label>
        <label>
          Email
          <input name="email" type="email" />
        </label>
        <label>
          Phone
          <input name="phone" />
        </label>
        <label>
          Address
          <textarea name="address" rows={3} />
        </label>
        <label>
          Notes
          <textarea name="notes" rows={3} />
        </label>
        <button type="submit">Save Customer</button>
      </form>
    </section>
  );
}
