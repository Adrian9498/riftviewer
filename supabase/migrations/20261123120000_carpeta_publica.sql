-- Carpeta pública: una foto de tu colección que cualquiera puede ver con el enlace (riftviewer.com/carpeta/#slug).
-- Cada cuenta tiene a lo más una. Solo su dueño la crea, la actualiza o la borra; leerla no requiere sesión
-- (tampoco con la beta cerrada: es justo para enseñarla).
--
-- Ver las carpetas publicadas:   select slug, title, updated_at from public.public_binders order by updated_at desc;
-- Quitar una carpeta:            delete from public.public_binders where slug = '...';

create table public.public_binders (
  slug       text primary key check (slug ~ '^[a-z0-9]{8,16}$'),
  user_id    uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  title      text not null default '' check (char_length(title) <= 60),
  data       jsonb not null check (pg_column_size(data) < 800000),
  updated_at timestamptz not null default now()
);

alter table public.public_binders enable row level security;

create policy "carpeta: cualquiera la lee" on public.public_binders
  for select to anon, authenticated using (true);
create policy "carpeta: el dueño la crea" on public.public_binders
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "carpeta: el dueño la actualiza" on public.public_binders
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "carpeta: el dueño la borra" on public.public_binders
  for delete to authenticated using (user_id = (select auth.uid()));

grant select on public.public_binders to anon, authenticated;
grant insert, update, delete on public.public_binders to authenticated;
