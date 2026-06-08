-- Wulfzx.underground Invoice Tracker
-- Supabase / Postgres starter schema

create extension if not exists "uuid-ossp";

-- Updated timestamp helper
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- User profile
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Company settings
create table if not exists public.company_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null default 'Wulfzx.underground',
  company_email text,
  company_phone text,
  company_address text,
  logo_url text,
  default_currency text not null default 'USD',
  default_tax_rate numeric(10, 4) not null default 0,
  invoice_prefix text not null default 'WZX',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- Per-user invoice sequence, used for safe automatic WZX-YYYY-0001 numbers.
create table if not exists public.invoice_sequences (
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_year integer not null,
  prefix text not null default 'WZX',
  last_sequence integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, invoice_year, prefix)
);

create or replace function public.next_invoice_number(p_prefix text, p_year integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_sequence integer;
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.invoice_sequences (user_id, invoice_year, prefix, last_sequence)
  values (current_user_id, p_year, p_prefix, 1)
  on conflict (user_id, invoice_year, prefix)
  do update set
    last_sequence = public.invoice_sequences.last_sequence + 1,
    updated_at = now()
  returning last_sequence into next_sequence;

  return p_prefix || '-' || p_year::text || '-' || lpad(next_sequence::text, 4, '0');
end;
$$;

grant execute on function public.next_invoice_number(text, integer) to authenticated;

-- Customers / clients
create table if not exists public.customers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Invoices
create table if not exists public.invoices (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  invoice_number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  notes text,
  terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, invoice_number)
);

-- Invoice line items
create table if not exists public.invoice_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- Payments received
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  payment_date date not null default current_date,
  amount numeric(12, 2) not null check (amount >= 0),
  payment_method text not null default 'other' check (payment_method in ('cash', 'bank_transfer', 'card', 'paypal', 'zelle', 'cash_app', 'check', 'other')),
  reference_number text,
  notes text,
  created_at timestamptz not null default now()
);

-- Expense categories
create table if not exists public.expense_categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

-- Expenses / receipts
create table if not exists public.expenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.expense_categories(id) on delete set null,
  vendor text,
  expense_date date not null default current_date,
  amount numeric(12, 2) not null check (amount >= 0),
  payment_method text not null default 'other',
  receipt_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Triggers
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_company_settings_updated_at
before update on public.company_settings
for each row execute function public.set_updated_at();

create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create trigger set_invoices_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_sequences enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

-- RLS Policies: each signed-in user can access only their own rows
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id);

create policy "company_settings_all_own" on public.company_settings
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "customers_all_own" on public.customers
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "invoices_all_own" on public.invoices
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "invoice_sequences_all_own" on public.invoice_sequences
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "invoice_items_all_own" on public.invoice_items
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "payments_all_own" on public.payments
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "expense_categories_all_own" on public.expense_categories
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "expenses_all_own" on public.expenses
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Data API grants
-- RLS still scopes rows to each authenticated owner; these grants simply allow
-- signed-in users to reach the tables through Supabase's REST/Data API.
grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on table public.profiles to authenticated, service_role;
grant select, insert, update, delete on table public.company_settings to authenticated, service_role;
grant select, insert, update, delete on table public.invoice_sequences to authenticated, service_role;
grant select, insert, update, delete on table public.customers to authenticated, service_role;
grant select, insert, update, delete on table public.invoices to authenticated, service_role;
grant select, insert, update, delete on table public.invoice_items to authenticated, service_role;
grant select, insert, update, delete on table public.payments to authenticated, service_role;
grant select, insert, update, delete on table public.expense_categories to authenticated, service_role;
grant select, insert, update, delete on table public.expenses to authenticated, service_role;
