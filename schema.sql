-- VYRA HUB: esquema inicial. Execute no SQL Editor do Supabase.
create extension if not exists pgcrypto;
create type public.user_role as enum ('admin','client');
create type public.post_status as enum ('draft','pending','approved','changes_requested','published');
create table public.clients (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 service_summary text,
 created_at timestamptz not null default now()
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text,
 role public.user_role not null default 'client',
 client_id uuid references public.clients(id) on delete cascade,
 must_change_password boolean not null default false,
 created_at timestamptz not null default now(),
 constraint profile_role_client_check check ((role='admin' and client_id is null) or (role='client' and client_id is not null))
);
create table public.posts (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.clients(id) on delete cascade,
 title text not null,
 caption text,
 format text,
 scheduled_for date,
 status public.post_status not null default 'draft',
 created_at timestamptz not null default now()
);
create table public.comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.posts(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 body text not null,
 created_at timestamptz not null default now()
);
create table public.briefings (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.clients(id) on delete cascade,
 content jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table public.deliverables (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.clients(id) on delete cascade,
 title text not null,
 file_path text,
 created_at timestamptz not null default now()
);
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
create or replace function public.owns_client(cid uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='client' and client_id=cid) $$;
alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.briefings enable row level security;
alter table public.deliverables enable row level security;
create policy "admins manage clients" on public.clients for all using(public.is_admin()) with check(public.is_admin());
create policy "client reads own profile" on public.profiles for select using(id=auth.uid() or public.is_admin());
create policy "admins manage profiles" on public.profiles for all using(public.is_admin()) with check(public.is_admin());
create policy "client reads own client" on public.clients for select using(public.owns_client(id));
create policy "admin all posts" on public.posts for all using(public.is_admin()) with check(public.is_admin());
create policy "client reads own posts" on public.posts for select using(public.owns_client(client_id));
create policy "client approves own posts" on public.posts for update using(public.owns_client(client_id)) with check(public.owns_client(client_id));
create policy "admin all comments" on public.comments for all using(public.is_admin()) with check(public.is_admin());
create policy "client reads comments on own posts" on public.comments for select using(exists(select 1 from public.posts p where p.id=post_id and public.owns_client(p.client_id)));
create policy "client comments on own posts" on public.comments for insert with check(author_id=auth.uid() and exists(select 1 from public.posts p where p.id=post_id and public.owns_client(p.client_id)));
create policy "admin all briefings" on public.briefings for all using(public.is_admin()) with check(public.is_admin());
create policy "client reads own briefing" on public.briefings for select using(public.owns_client(client_id));
create policy "admin all deliverables" on public.deliverables for all using(public.is_admin()) with check(public.is_admin());
create policy "client reads own deliverables" on public.deliverables for select using(public.owns_client(client_id));
-- Importante: crie usuários pelo Supabase Auth; depois insira o perfil correspondente.
-- Nunca exponha a service_role key no navegador.
