-- Add per-invoice template selection and make Professional Clean the default.

alter table public.company_settings
  alter column invoice_template set default 'professional_clean';

alter table public.invoices
  add column if not exists invoice_template text not null default 'professional_clean';

update public.company_settings
set invoice_template = 'professional_clean'
where invoice_template is null
   or invoice_template = ''
   or invoice_template = 'wulfzx_blueprint';

update public.invoices
set invoice_template = 'professional_clean'
where invoice_template is null
   or invoice_template = ''
   or invoice_template = 'wulfzx_blueprint';
