-- Wulfzx branded invoice template support.
-- Safe to run more than once.

alter table public.company_settings
  add column if not exists invoice_template text not null default 'wulfzx_blueprint';

alter table public.invoices
  add column if not exists shipping_amount numeric(12, 2) not null default 0,
  add column if not exists deposit_amount numeric(12, 2) not null default 0,
  add column if not exists ship_to_name text,
  add column if not exists ship_to_address text,
  add column if not exists ship_to_contact text,
  add column if not exists payment_terms text;

update public.company_settings
set invoice_template = 'wulfzx_blueprint'
where invoice_template is null or invoice_template = '';

