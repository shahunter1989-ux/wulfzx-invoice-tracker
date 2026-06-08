import Link from "next/link";
import { requireUser } from "../../../lib/auth";
import { ensureUserDefaults } from "../../../lib/data";
import { InvoiceForm } from "../../../components/InvoiceForm";

export const dynamic = "force-dynamic";

type CustomerOption = {
  id: string;
  name: string;
};

type NewInvoicePageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewInvoicePage({ searchParams }: NewInvoicePageProps) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  await ensureUserDefaults(supabase, user);
  const { data: customers } = await supabase.from("customers").select("id,name").order("name");

  return (
    <section className="card">
      <div className="page-header">
        <div>
          <h1>New Invoice</h1>
          <p className="muted">Create Wulfzx.underground invoices using automatic WZX numbering.</p>
        </div>
        <Link className="secondary-link" href="/invoices">
          Back to invoices
        </Link>
      </div>

      {params.error ? <div className="notice error">{params.error}</div> : null}
      {(customers ?? []).length === 0 ? (
        <div className="notice warning">
          Add a customer before creating an invoice. <Link href="/customers/new">Create customer</Link>
        </div>
      ) : null}

      <InvoiceForm customers={(customers ?? []) as CustomerOption[]} />
    </section>
  );
}
