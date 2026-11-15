-- Valor de una colección día por día, con los precios guardados en price_days.
-- p_items: la colección como la guarda la app, { "RAD-001": { "normal": 2, "foil": 1 }, ... }.
-- Normal usa el precio de mercado normal; foil, metal y metal deluxe, el de mercado foil (igual que la app).
-- Se calcula aquí para no bajar los precios completos de cada día al navegador.
create function public.collection_value_history(p_items jsonb, p_days int default 365)
returns table (day date, value numeric, priced int)
language sql stable security invoker set search_path = ''
as $$
  with items as (
    select upper(c.key) as code, case when f.key = 'normal' then 0 else 2 end as idx, (f.value)::int as n
    from jsonb_each(coalesce(p_items, '{}'::jsonb)) c
    cross join lateral jsonb_each_text(case when jsonb_typeof(c.value) = 'object' then c.value else '{}'::jsonb end) f
    where f.value ~ '^\d+$' and (f.value)::int > 0
  )
  select d.day,
         round(sum(i.n * coalesce((d.prices -> i.code ->> i.idx)::numeric, 0)), 2) as value,
         sum(case when d.prices -> i.code ->> i.idx is not null then i.n else 0 end)::int as priced
  from public.price_days d
  cross join items i
  where d.day > current_date - least(greatest(p_days, 1), 1095)
  group by d.day
  order by d.day
$$;
grant execute on function public.collection_value_history(jsonb, int) to anon, authenticated;
