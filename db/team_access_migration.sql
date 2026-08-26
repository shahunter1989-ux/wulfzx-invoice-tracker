-- WCHU submit-only staff access migration
-- Run this once in Supabase SQL Editor before deploying the team-access app.

create extension if not exists "uuid-ossp";

create table if not exists public.workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null default 'WCHU',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id)
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'employee', 'intern')),
  status text not null default 'active' check (status in ('active', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('employee', 'intern')),
  status text not null default 'sent' check (status in ('sent', 'accepted', 'revoked')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  invited_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.submission_queue (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  submission_type text not null check (submission_type in ('customer', 'invoice', 'payment', 'expense')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'needs_correction')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.company_settings add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.invoice_sequences add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.customers add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.invoices add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.invoice_items add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.payments add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.expense_categories add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.expenses add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

with source_users as (
  select user_id from public.company_settings
  union
  select user_id from public.invoice_sequences
  union
  select user_id from public.customers
  union
  select user_id from public.invoices
  union
  select user_id from public.invoice_items
  union
  select user_id from public.payments
  union
  select user_id from public.expense_categories
  union
  select user_id from public.expenses
),
preferred_settings as (
  select distinct on (user_id) user_id, company_name
  from public.company_settings
  order by user_id, updated_at desc
)
insert into public.workspaces (owner_id, name)
select source_users.user_id, coalesce(nullif(preferred_settings.company_name, ''), 'WCHU')
from source_users
left join preferred_settings on preferred_settings.user_id = source_users.user_id
where source_users.user_id is not null
on conflict (owner_id) do nothing;

insert into public.workspace_members (workspace_id, user_id, role, status)
select w.id, w.owner_id, 'owner', 'active'
from public.workspaces w
on conflict (workspace_id, user_id) do update set role = 'owner', status = 'active';

update public.company_settings cs set workspace_id = w.id
from public.workspaces w
where cs.workspace_id is null and cs.user_id = w.owner_id;

update public.invoice_sequences s set workspace_id = w.id
from public.workspaces w
where s.workspace_id is null and s.user_id = w.owner_id;

update public.customers c set workspace_id = w.id
from public.workspaces w
where c.workspace_id is null and c.user_id = w.owner_id;

update public.invoices i set workspace_id = w.id
from public.workspaces w
where i.workspace_id is null and i.user_id = w.owner_id;

update public.invoice_items ii set workspace_id = i.workspace_id
from public.invoices i
where ii.workspace_id is null and ii.invoice_id = i.id;

update public.payments p set workspace_id = i.workspace_id
from public.invoices i
where p.workspace_id is null and p.invoice_id = i.id;

update public.expense_categories ec set workspace_id = w.id
from public.workspaces w
where ec.workspace_id is null and ec.user_id = w.owner_id;

update public.expenses e set workspace_id = w.id
from public.workspaces w
where e.workspace_id is null and e.user_id = w.owner_id;

alter table public.company_settings alter column workspace_id set not null;
alter table public.invoice_sequences alter column workspace_id set not null;
alter table public.customers alter column workspace_id set not null;
alter table public.invoices alter column workspace_id set not null;
alter table public.invoice_items alter column workspace_id set not null;
alter table public.payments alter column workspace_id set not null;
alter table public.expense_categories alter column workspace_id set not null;
alter table public.expenses alter column workspace_id set not null;

create index if not exists workspace_members_user_idx on public.workspace_members(user_id, status);
create index if not exists submission_queue_workspace_status_idx on public.submission_queue(workspace_id, status, created_at desc);
create index if not exists submission_queue_submitter_idx on public.submission_queue(submitted_by, created_at desc);
create index if not exists audit_events_workspace_idx on public.audit_events(workspace_id, created_at desc);
create index if not exists customers_workspace_name_idx on public.customers(workspace_id, name);
create index if not exists invoices_workspace_number_idx on public.invoices(workspace_id, invoice_number);
create index if not exists payments_workspace_date_idx on public.payments(workspace_id, payment_date desc);
create index if not exists expenses_workspace_date_idx on public.expenses(workspace_id, expense_date desc);
create unique index if not exists company_settings_workspace_unique on public.company_settings(workspace_id);
create unique index if not exists expense_categories_workspace_name_unique on public.expense_categories(workspace_id, name);

create or replace function public.current_workspace_role(p_workspace_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select wm.role
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = auth.uid()
    and wm.status = 'active'
  limit 1
$$;

create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_workspace_role(p_workspace_id) = 'owner'
$$;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_workspace_role(p_workspace_id) in ('owner', 'employee', 'intern')
$$;

create or replace function public.next_workspace_invoice_number(p_workspace_id uuid, p_prefix text, p_year integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_sequence integer;
  owner_user_id uuid;
begin
  if not public.is_workspace_owner(p_workspace_id) then
    raise exception 'Only workspace owners can generate invoice numbers';
  end if;

  select owner_id into owner_user_id from public.workspaces where id = p_workspace_id;
  if owner_user_id is null then
    raise exception 'Workspace not found';
  end if;

  insert into public.invoice_sequences (workspace_id, user_id, invoice_year, prefix, last_sequence)
  values (p_workspace_id, owner_user_id, p_year, p_prefix, 1)
  on conflict (user_id, invoice_year, prefix)
  do update set
    last_sequence = public.invoice_sequences.last_sequence + 1,
    updated_at = now()
  returning last_sequence into next_sequence;

  return p_prefix || '-' || p_year::text || '-' || lpad(next_sequence::text, 4, '0');
end;
$$;

create or replace function public.workspace_customer_picker(p_workspace_id uuid)
returns table(id uuid, name text, contact_label text)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id,
    c.name,
    case
      when nullif(c.contact_name, '') is not null then c.contact_name
      when nullif(c.email, '') is not null then regexp_replace(c.email, '(^.).*(@.*$)', '\1***\2')
      when nullif(c.phone, '') is not null then '***' || right(regexp_replace(c.phone, '[^0-9]', '', 'g'), 4)
      else ''
    end as contact_label
  from public.customers c
  where c.workspace_id = p_workspace_id
    and public.is_workspace_member(p_workspace_id)
  order by c.name
  limit 200
$$;

create or replace function public.workspace_invoice_picker(p_workspace_id uuid)
returns table(id uuid, invoice_number text, customer_name text, status text, balance_due numeric)
language sql
security definer
set search_path = public
stable
as $$
  select
    i.id,
    i.invoice_number,
    coalesce(c.name, 'No customer') as customer_name,
    i.status,
    greatest(i.total_amount - coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id), 0), 0) as balance_due
  from public.invoices i
  left join public.customers c on c.id = i.customer_id
  where i.workspace_id = p_workspace_id
    and public.is_workspace_member(p_workspace_id)
    and i.status <> 'cancelled'
  order by i.created_at desc
  limit 200
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.submission_queue enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member" on public.workspaces
for select using (public.is_workspace_member(id));

drop policy if exists "workspaces_update_owner" on public.workspaces;
create policy "workspaces_update_owner" on public.workspaces
for update using (public.is_workspace_owner(id)) with check (public.is_workspace_owner(id));

drop policy if exists "workspace_members_select_same_workspace" on public.workspace_members;
create policy "workspace_members_select_same_workspace" on public.workspace_members
for select using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_members_owner_all" on public.workspace_members;
create policy "workspace_members_owner_all" on public.workspace_members
for all using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

drop policy if exists "workspace_invites_owner_all" on public.workspace_invites;
create policy "workspace_invites_owner_all" on public.workspace_invites
for all using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

drop policy if exists "submission_queue_select_owner_or_own" on public.submission_queue;
create policy "submission_queue_select_owner_or_own" on public.submission_queue
for select using (public.is_workspace_owner(workspace_id) or submitted_by = auth.uid());

drop policy if exists "submission_queue_insert_submitter" on public.submission_queue;
create policy "submission_queue_insert_submitter" on public.submission_queue
for insert with check (submitted_by = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists "submission_queue_update_owner" on public.submission_queue;
create policy "submission_queue_update_owner" on public.submission_queue
for update using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

drop policy if exists "audit_events_owner_select" on public.audit_events;
create policy "audit_events_owner_select" on public.audit_events
for select using (public.is_workspace_owner(workspace_id));

drop policy if exists "audit_events_owner_insert" on public.audit_events;
create policy "audit_events_owner_insert" on public.audit_events
for insert with check (public.is_workspace_owner(workspace_id));

-- Replace business-table policies so official records are owner-visible only.
drop policy if exists "company_settings_all_own" on public.company_settings;
create policy "company_settings_owner_all" on public.company_settings
for all using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

drop policy if exists "customers_all_own" on public.customers;
create policy "customers_owner_all" on public.customers
for all using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

drop policy if exists "invoices_all_own" on public.invoices;
create policy "invoices_owner_all" on public.invoices
for all using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

drop policy if exists "invoice_items_all_own" on public.invoice_items;
create policy "invoice_items_owner_all" on public.invoice_items
for all using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

drop policy if exists "payments_all_own" on public.payments;
create policy "payments_owner_all" on public.payments
for all using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

drop policy if exists "expense_categories_all_own" on public.expense_categories;
create policy "expense_categories_owner_all" on public.expense_categories
for all using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

drop policy if exists "expenses_all_own" on public.expenses;
create policy "expenses_owner_all" on public.expenses
for all using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

drop policy if exists "invoice_sequences_all_own" on public.invoice_sequences;
create policy "invoice_sequences_owner_all" on public.invoice_sequences
for all using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

grant usage on schema public to authenticated, service_role;
grant execute on function public.current_workspace_role(uuid) to authenticated, service_role;
grant execute on function public.is_workspace_owner(uuid) to authenticated, service_role;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function public.next_workspace_invoice_number(uuid, text, integer) to authenticated, service_role;
grant execute on function public.workspace_customer_picker(uuid) to authenticated, service_role;
grant execute on function public.workspace_invoice_picker(uuid) to authenticated, service_role;

grant select, insert, update, delete on table public.workspaces to authenticated, service_role;
grant select, insert, update, delete on table public.workspace_members to authenticated, service_role;
grant select, insert, update, delete on table public.workspace_invites to authenticated, service_role;
grant select, insert, update, delete on table public.submission_queue to authenticated, service_role;
grant select, insert, update, delete on table public.audit_events to authenticated, service_role;
