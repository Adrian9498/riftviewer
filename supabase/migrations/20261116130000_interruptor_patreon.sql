-- Interruptor de Patreon (Full Access).
--
-- Apagado (por defecto, para la beta Friends & Family): todos tienen todo desbloqueado y la app no muestra
-- nada de Patreon (sin candados, sin marca de agua, sin "Conectar con Patreon").
-- Encendido: vuelve el plan Gratis / Full Access y la conexión con Patreon, como antes.
--
-- Encender:  update public.beta_config set patreon = true;
-- Apagar:    update public.beta_config set patreon = false;

alter table public.beta_config add column patreon boolean not null default false;

-- el estado que lee la app ahora también dice si Patreon está encendido
create or replace function public.beta_estado()
returns json
language sql stable security definer set search_path = ''
as $$
  select json_build_object(
    'cerrada', c.cerrada,
    'acceso', not c.cerrada or exists (
      select 1 from public.beta_invitados i
      where i.email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    ),
    'patreon', c.patreon
  )
  from public.beta_config c
  where c.id
$$;
