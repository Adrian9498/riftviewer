-- Patreon: vincular la cuenta de Patreon de un usuario y mantener su plan al día.
-- No se guardan tokens de Patreon: el plan se actualiza al conectar y con los webhooks de Patreon.

-- Una cuenta de Patreon solo puede estar vinculada a un usuario.
create table public.patreon_links (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  patreon_user_id text not null unique,
  patron_status   text,
  tier_ids        text[] not null default '{}',
  updated_at      timestamptz not null default now()
);
alter table public.patreon_links enable row level security;
create policy "vinculo propio: leer" on public.patreon_links
  for select to authenticated using (user_id = (select auth.uid()));

-- Estados de OAuth de un solo uso (protegen el regreso de Patreon). Solo los usa el servidor.
create table public.patreon_oauth_states (
  state      text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  return_to  text not null,
  created_at timestamptz not null default now()
);
alter table public.patreon_oauth_states enable row level security;   -- sin políticas: solo service_role
