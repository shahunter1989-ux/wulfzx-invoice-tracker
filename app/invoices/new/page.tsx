import Link from "next/link";
import { ensureUserDefaults } from "../../../lib/data";
import { InvoiceForm } from "../../../components/InvoiceForm";
import { InvoiceTemplatePreviewGrid } from "../../../components/InvoiceTemplatePreviewGrid";
import { requireOwner } from "../../../lib/workspace";

export const dynamic = "force-dynamic";

type CustomerOption = {
  id: string;
  name: string;
};

type Settings = {
  invoice_template: string | null;
};

type NewInvoicePageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewInvoicePage({ searchParams }: NewInvoicePageProps) {
  const params = await searchParams;
  const { supabase, user, workspace } = await requireOwner();
  await ensureUserDefaults(supabase, user, workspace.id);
  const [{ data: customers }, { data: settings }] = await Promise.all([
    supabase.from("customers").select("id,name").eq("workspace_id", workspace.id).order("name"),
    supabase.from("company_settings").select("invoice_template").eq("workspace_id", workspace.id).maybeSingle()
  ]);

  return (
    <section className="card">
      <div className="page-header">
        <div>
          <h1>New Invoice</h1>
          <p className="muted">Create WCHU invoices using automatic WCHU numbering.</p>
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

      <InvoiceTemplatePreviewGrid />
      <InvoiceForm customers={(customers ?? []) as CustomerOption[]} defaultTemplate={(settings as Settings | null)?.invoice_template} />
    </section>
  );
}
