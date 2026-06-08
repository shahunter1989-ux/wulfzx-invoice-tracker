import Link from "next/link";
import { notFound } from "next/navigation";
import { updateCustomerAction } from "../../../actions";
import { requireUser } from "../../../../lib/auth";
import { ensureUserDefaults } from "../../../../lib/data";

export const dynamic = "force-dynamic";

type EditCustomerPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

type Customer = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

export default async function EditCustomerPage({ params, searchParams }: EditCustomerPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, user } = await requireUser();
  await ensureUserDefaults(supabase, user);

  const { data: customer } = await supabase
    .from("customers")
    .select("id,name,contact_name,email,phone,address,notes")
    .eq("id", id)
    .single();

  if (!customer) notFound();

  const detail = customer as Customer;

  return (
    <section className="card narrow-card">
      <div className="page-header">
        <div>
          <h1>Edit Customer</h1>
          <p className="muted">Update customer contact details used for future invoices.</p>
        </div>
        <Link className="secondary-link" href="/customers">
          Back to customers
        </Link>
      </div>

      {query.error ? <div className="notice error">{query.error}</div> : null}

      <form action={updateCustomerAction} className="grid form-grid">
        <input type="hidden" name="customer_id" value={detail.id} />
        <label>
          Customer or client name
          <input name="name" defaultValue={detail.name} required />
        </label>
        <label>
          Contact name
          <input name="contact_name" defaultValue={detail.contact_name ?? ""} />
        </label>
        <label>
          Email
          <input name="email" type="email" defaultValue={detail.email ?? ""} />
        </label>
        <label>
          Phone
          <input name="phone" defaultValue={detail.phone ?? ""} />
        </label>
        <label>
          Address
          <textarea name="address" rows={3} defaultValue={detail.address ?? ""} />
        </label>
        <label>
          Notes
          <textarea name="notes" rows={3} defaultValue={detail.notes ?? ""} />
        </label>
        <button type="submit">Save Changes</button>
      </form>
    </section>
  );
}
