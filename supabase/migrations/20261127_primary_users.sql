-- VYRA HUB: identifica o usuário principal de cada empresa.
-- O primeiro acesso de cliente criado para cada empresa passa a ser o principal.
alter table public.profiles
  add column if not exists is_primary boolean not null default false;

with ranked_client_users as (
  select
    id,
    row_number() over (
      partition by client_id
      order by created_at asc nulls last, id asc
    ) as position
  from public.profiles
  where role = 'client'
    and client_id is not null
)
update public.profiles as profiles
set is_primary = (ranked_client_users.position = 1)
from ranked_client_users
where profiles.id = ranked_client_users.id;

create unique index if not exists profiles_one_primary_per_client
  on public.profiles (client_id)
  where role = 'client' and is_primary = true;
