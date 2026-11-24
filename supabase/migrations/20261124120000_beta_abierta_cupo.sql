-- Beta abierta con cupo: cualquiera puede crear cuenta hasta llenar los lugares (100 al abrir).
-- Para usar la app hace falta una cuenta; las que ya existen cuentan dentro del cupo.
-- Los correos de beta_invitados siempre pueden entrar y registrarse, aunque el cupo esté lleno.
--
-- Cambiar el cupo:            update public.beta_config set cupo = 200;
-- Sin límite (todos):         update public.beta_config set cupo = null;
-- Volver a solo invitados:    update public.beta_config set cerrada = true;
-- Ver cuántas cuentas hay:    select count(*) from auth.users;

alter table public.beta_config add column cupo int check (cupo is null or cupo >= 0);

-- abrimos: sin invitación, con 100 lugares
update public.beta_config set cerrada = false, cupo = 100 where id;

-- ¿Cuántas cuentas hay? (solo para estas funciones)
create or replace function public.beta_cuentas()
returns int
language sql stable security definer set search_path = ''
as $$ select count(*)::int from auth.users $$;
revoke all on function public.beta_cuentas() from public, anon, authenticated;

-- El estado que lee la app: también el cupo, cuántos lugares quedan y si la sesión tiene acceso.
-- Con cupo, el acceso es tener sesión (las cuentas solo se crean si hay lugar).
create or replace function public.beta_estado()
returns json
language sql stable security definer set search_path = ''
as $$
  select json_build_object(
    'cerrada', c.cerrada,
    'acceso', case
      when c.cerrada then exists (
        select 1 from public.beta_invitados i
        where i.email = lower(coalesce((select auth.jwt() ->> 'email'), '')))
      when c.cupo is not null then (select auth.uid()) is not null
      else true
    end,
    'patreon', c.patreon,
    'cupo', c.cupo,
    'lugares', case when c.cupo is null then null else greatest(c.cupo - public.beta_cuentas(), 0) end
  )
  from public.beta_config c
  where c.id
$$;
revoke all on function public.beta_estado() from public;
grant execute on function public.beta_estado() to anon, authenticated;

-- El candado del registro: con la beta cerrada, solo invitados; abierta con cupo, hasta llenar los lugares.
create or replace function public.beta_revisar_registro()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  c public.beta_config;
  invitado boolean;
begin
  select * into c from public.beta_config where id;
  invitado := exists (select 1 from public.beta_invitados where email = lower(trim(new.email)));
  if c.cerrada and not invitado then
    raise exception 'beta cerrada: este correo no tiene invitación' using errcode = 'P0001';
  end if;
  if not c.cerrada and c.cupo is not null and not invitado and public.beta_cuentas() >= c.cupo then
    raise exception 'cupo lleno: ya no quedan lugares en la beta' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.beta_revisar_registro() from public;
