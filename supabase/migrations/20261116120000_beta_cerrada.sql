-- Beta cerrada: un interruptor y una lista de correos invitados.
--
-- Cerrar la beta (por defecto):      update public.beta_config set cerrada = true;
-- Abrirla a todos:                   update public.beta_config set cerrada = false;
-- Invitar a alguien:                 insert into public.beta_invitados (email) values ('alguien@correo.com');
-- Quitar una invitación:             delete from public.beta_invitados where email = 'alguien@correo.com';
-- Ver cuántos invitados hay:         select count(*) from public.beta_invitados;
--
-- Con la beta cerrada:
-- - Solo los correos invitados pueden crear cuenta (también con Google o Discord). Lo revisa la base de datos,
--   así que no se puede saltar desde la página.
-- - La app pide iniciar sesión y solo deja pasar a los invitados (las cuentas que ya existían también necesitan invitación).

create table public.beta_config (
  id      boolean primary key default true check (id),   -- una sola fila
  cerrada boolean not null default true
);
insert into public.beta_config (id, cerrada) values (true, true);

create table public.beta_invitados (
  email      text primary key check (email = lower(trim(email))),
  nota       text,
  created_at timestamptz not null default now()
);

-- nadie las lee ni escribe desde la app: solo el panel de Supabase y las funciones de abajo
alter table public.beta_config enable row level security;
alter table public.beta_invitados enable row level security;

-- ¿Está cerrada la beta, y la sesión actual tiene acceso? (sin sesión: acceso solo si está abierta)
create function public.beta_estado()
returns json
language sql stable security definer set search_path = ''
as $$
  select json_build_object(
    'cerrada', c.cerrada,
    'acceso', not c.cerrada or exists (
      select 1 from public.beta_invitados i
      where i.email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    )
  )
  from public.beta_config c
  where c.id
$$;
revoke all on function public.beta_estado() from public;
grant execute on function public.beta_estado() to anon, authenticated;

-- Candado del registro: con la beta cerrada, solo se crean cuentas de correos invitados.
create function public.beta_revisar_registro()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select cerrada from public.beta_config where id)
     and not exists (select 1 from public.beta_invitados where email = lower(trim(new.email))) then
    raise exception 'beta cerrada: este correo no tiene invitación' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.beta_revisar_registro() from public;

create trigger beta_solo_invitados
  before insert on auth.users
  for each row execute function public.beta_revisar_registro();
