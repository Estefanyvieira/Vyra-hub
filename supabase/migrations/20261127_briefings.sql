-- VYRA HUB · Briefings editáveis com histórico privado de alterações
alter table public.briefings
  add column if not exists title text not null default 'Novo briefing',
  add column if not exists status text not null default 'published',
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.briefing_change_logs (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references public.briefings(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  old_content jsonb not null,
  new_content jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.briefing_change_logs enable row level security;
drop policy if exists "admin reads briefing change logs" on public.briefing_change_logs;
create policy "admin reads briefing change logs"
  on public.briefing_change_logs for select
  using (public.is_admin());

drop policy if exists "client updates own briefing content" on public.briefings;
create policy "client updates own briefing content"
  on public.briefings for update
  using (public.owns_client(client_id))
  with check (public.owns_client(client_id));

create or replace function public.protect_and_log_briefing_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.client_id is distinct from old.client_id
       or new.title is distinct from old.title
       or new.status is distinct from old.status
       or new.created_at is distinct from old.created_at then
      raise exception 'Clientes podem editar somente o conteúdo do briefing.';
    end if;

    if new.content is distinct from old.content then
      insert into public.briefing_change_logs
        (briefing_id, client_id, actor_id, old_content, new_content)
      values
        (old.id, old.client_id, auth.uid(), old.content, new.content);
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists briefing_protect_and_log_update on public.briefings;
create trigger briefing_protect_and_log_update
before update on public.briefings
for each row execute function public.protect_and_log_briefing_update();

-- Briefings ativos ficam visíveis ao cliente; rascunhos permanecem somente na administração.
drop policy if exists "client reads own briefing" on public.briefings;
create policy "client reads published own briefings"
  on public.briefings for select
  using (public.owns_client(client_id) and status = 'published');

-- Clientes não podem inserir nem excluir briefings. A política de administração existente
-- continua permitindo criar, renomear, arquivar e excluir pela área VYRA.
