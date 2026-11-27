-- VYRA HUB | Módulos de Arquivos, Financeiro e Portfólio
-- Execute este arquivo uma única vez no SQL Editor do Supabase.

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null default 'Complementar',
  price numeric(12,2),
  price_label text,
  is_portfolio_visible boolean not null default true,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_price_nonnegative check (price is null or price >= 0)
);

create table if not exists public.client_packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  package_name text not null,
  monthly_price numeric(12,2) not null,
  billing_day integer,
  starts_at date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_packages_price_nonnegative check (monthly_price >= 0),
  constraint client_packages_billing_day_check check (billing_day is null or billing_day between 1 and 31)
);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null,
  due_date date not null,
  paid_at timestamptz,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_transactions_amount_nonnegative check (amount >= 0),
  constraint financial_transactions_status_check check (status in ('pending','paid','overdue','cancelled'))
);

create index if not exists services_portfolio_idx on public.services (active, is_portfolio_visible, display_order);
create index if not exists client_packages_client_idx on public.client_packages (client_id, active);
create index if not exists financial_transactions_client_due_idx on public.financial_transactions (client_id, due_date desc);

alter table public.services enable row level security;
alter table public.client_packages enable row level security;
alter table public.financial_transactions enable row level security;

drop policy if exists "services visible to authenticated" on public.services;
create policy "services visible to authenticated" on public.services
  for select to authenticated using (active = true and is_portfolio_visible = true or public.is_admin());

drop policy if exists "admins manage services" on public.services;
create policy "admins manage services" on public.services
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage client packages" on public.client_packages;
create policy "admins manage client packages" on public.client_packages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "clients read own package" on public.client_packages;
create policy "clients read own package" on public.client_packages
  for select to authenticated using (public.owns_client(client_id));

drop policy if exists "admins manage financial transactions" on public.financial_transactions;
create policy "admins manage financial transactions" on public.financial_transactions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "clients read own financial transactions" on public.financial_transactions;
create policy "clients read own financial transactions" on public.financial_transactions
  for select to authenticated using (public.owns_client(client_id));

grant select, insert, update, delete on public.services to authenticated;
grant select on public.client_packages to authenticated;
grant select on public.financial_transactions to authenticated;
grant insert, update, delete on public.client_packages to authenticated;
grant insert, update, delete on public.financial_transactions to authenticated;

-- A tabela deliverables existente continua sendo a base da área de arquivos.
-- Acesso a linhas e arquivos deve permanecer condicionado às policies RLS
-- já configuradas para deliverables e ao bucket privado client-content.
