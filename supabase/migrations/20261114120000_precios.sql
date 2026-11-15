-- Precios de cartas (TCGplayer, vía tcgcsv.com) con historial: una fila por día con todos los precios.
-- Una fila por día (no una por carta) ocupa poco: ~2,500 cartas comprimidas, unos 25-40 KB por día.
-- prices: { "OGN-007A": [mercado normal, mínimo normal, mercado foil, mínimo foil, id de producto en TCGplayer], ... }

create table public.price_days (
  day        date primary key,
  prices     jsonb not null,
  source     text not null default 'tcgplayer',
  updated_at timestamptz not null default now()
);
alter table public.price_days enable row level security;
-- son datos públicos: cualquiera los puede leer; solo la función prices-sync (service_role) escribe
create policy "precios: leer" on public.price_days for select to anon, authenticated using (true);

-- Historial de una carta sin bajar todos los días completos.
create function public.card_price_history(p_code text, p_days int default 365)
returns table (day date, price jsonb)
language sql stable security invoker set search_path = ''
as $$
  select d.day, d.prices -> upper(p_code)
  from public.price_days d
  where d.day > current_date - least(greatest(p_days, 1), 1095) and d.prices ? upper(p_code)
  order by d.day
$$;
grant execute on function public.card_price_history(text, int) to anon, authenticated;

-- Actualización diaria: pg_cron llama a la función prices-sync a las 21:30 UTC (tcgcsv publica ~20:00 UTC).
-- La URL del proyecto se lee del Vault. Una sola vez, en el SQL Editor de Supabase:
--   select vault.create_secret('https://TU-PROYECTO.supabase.co', 'project_url');
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('precios-diarios', '30 21 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/prices-sync',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$);
