-- Cuentas y sincronización en la nube del visualizador.
-- La app es local-first: todo funciona sin cuenta; con sesión, estos datos se sincronizan
-- entre dispositivos con "gana el cambio más reciente" (updated_at lo pone el cliente).

-- ---------------------------------------------------------------- perfiles
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- ajustes
-- data = { brand, sounds, view: { layout, camera, fmt } }
create table public.user_settings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- documentos (recientes)
-- Guiones: el texto va en `content`. Replays: el .json va al bucket "replays" (`storage_path`).
-- `deleted` es una lápida para que los demás dispositivos también lo quiten.
create table public.documents (
  user_id      uuid not null references auth.users (id) on delete cascade,
  doc_key      text not null,
  kind         text not null check (kind in ('replay', 'script')),
  name         text not null,
  subtitle     text,
  content      text,
  storage_path text,
  deleted      boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (user_id, doc_key)
);

-- ---------------------------------------------------------------- proyectos (clips y notas)
create table public.projects (
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_key text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, project_key)
);

-- ---------------------------------------------------------------- archivos propios
-- asset_key: 'card:RAD-164', 'card:n:<nombre>', 'brand:logo', 'brand:bg', 'snd:battle'…
create table public.user_assets (
  user_id      uuid not null references auth.users (id) on delete cascade,
  asset_key    text not null,
  storage_path text,
  content_type text,
  deleted      boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (user_id, asset_key)
);

-- ---------------------------------------------------------------- permisos (premium)
-- Solo los escribe el servidor (fase 3: Patreon). El usuario puede leer los suyos.
create table public.entitlements (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  tier        text not null default 'free',
  source      text,
  valid_until timestamptz,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- seguridad por fila
alter table public.profiles      enable row level security;
alter table public.user_settings enable row level security;
alter table public.documents     enable row level security;
alter table public.projects      enable row level security;
alter table public.user_assets   enable row level security;
alter table public.entitlements  enable row level security;

create policy "perfil propio: leer"       on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "perfil propio: actualizar" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "ajustes propios"    on public.user_settings for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "documentos propios" on public.documents     for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "proyectos propios"  on public.projects      for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "archivos propios"   on public.user_assets   for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "permisos propios: leer" on public.entitlements for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- alta de usuario
-- Al registrarse (email, Google o Discord) se crean su perfil y su plan gratuito.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name',
             new.raw_user_meta_data ->> 'user_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.entitlements (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- almacenamiento
-- Buckets privados; cada usuario solo accede a la carpeta con su id: <user_id>/...
insert into storage.buckets (id, name, public, file_size_limit)
values ('replays', 'replays', false, 10485760),        -- 10 MB
       ('user-assets', 'user-assets', false, 5242880);  -- 5 MB

create policy "archivos propios: leer" on storage.objects for select to authenticated
  using (bucket_id in ('replays', 'user-assets') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "archivos propios: subir" on storage.objects for insert to authenticated
  with check (bucket_id in ('replays', 'user-assets') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "archivos propios: reemplazar" on storage.objects for update to authenticated
  using (bucket_id in ('replays', 'user-assets') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "archivos propios: borrar" on storage.objects for delete to authenticated
  using (bucket_id in ('replays', 'user-assets') and (storage.foldername(name))[1] = (select auth.uid())::text);
