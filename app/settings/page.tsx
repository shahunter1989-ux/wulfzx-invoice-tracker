import { updateSettingsAction } from "../actions";
import { InvoiceTemplatePreviewGrid } from "../../components/InvoiceTemplatePreviewGrid";
import { InvoiceTemplateSelect } from "../../components/InvoiceTemplateSelect";
import { ensureUserDefaults } from "../../lib/data";
import { requireOwner } from "../../lib/workspace";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

type Settings = {
  company_name: string;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
  default_currency: string;
  default_tax_rate: number | string;
  invoice_prefix: string;
  invoice_template: string;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const { supabase, user, workspace } = await requireOwner();
  await ensureUserDefaults(supabase, user, workspace.id);
  const { data } = await supabase
    .from("company_settings")
    .select("company_name,company_email,company_phone,company_address,default_currency,default_tax_rate,invoice_prefix,invoice_template")
    .eq("workspace_id", workspace.id)
    .single();
  const settings = data as Settings | null;

  return (
    <section className="card narrow-card">
      <h1>Settings</h1>
      <p className="muted">Company settings for Wulfzx.underground.</p>
      {params.error ? <div className="notice error">{params.error}</div> : null}
      {params.saved ? <div className="notice success">Settings saved.</div> : null}
      <InvoiceTemplatePreviewGrid />
      <form action={updateSettingsAction} className="grid form-grid">
        <label>
          Company name
          <input name="company_name" defaultValue={settings?.company_name || "Wulfzx.underground"} required />
        </label>
        <label>
          Invoice prefix
          <input name="invoice_prefix" defaultValue={settings?.invoice_prefix || "WZX"} required />
        </label>
        <InvoiceTemplateSelect defaultValue={settings?.invoice_template} label="Default invoice template" />
        <label>
          Default currency
          <input name="default_currency" defaultValue={settings?.default_currency || "USD"} required />
        </label>
        <label>
          Default tax rate
          <input name="default_tax_rate" type="number" min="0" step="0.0001" defaultValue={Number(settings?.default_tax_rate ?? 0)} />
        </label>
        <label>
          Company email
          <input name="company_email" type="email" defaultValue={settings?.company_email || ""} />
        </label>
        <label>
          Company phone
          <input name="company_phone" defaultValue={settings?.company_phone || ""} />
        </label>
        <label>
          Company address
          <textarea name="company_address" rows={4} defaultValue={settings?.company_address || ""} />
        </label>
        <button type="submit">Save Settings</button>
      </form>
    </section>
  );
}
