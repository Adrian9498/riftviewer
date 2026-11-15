// Guarda los precios del día (TCGplayer vía tcgcsv.com) en la tabla price_days, que también hace de historial.
// La llama pg_cron una vez al día (ver la migración de precios). Es pública (sin JWT) pero no se puede abusar:
// si los precios de hoy ya se guardaron hace menos de 6 horas, no vuelve a descargarlos.
import { CATEGORY, TCGCSV, pricesForGroup, type DayPrices, type TcgGroup } from '../_shared/prices.ts';
import { admin, json } from '../_shared/server.ts';

const UA = { 'User-Agent': 'Riftviewer price sync (daily)' };
async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${TCGCSV}/${path}`, { headers: UA });
  if (!r.ok) throw new Error(`tcgcsv ${path}: ${r.status}`);
  return (await r.json()).results as T;
}

Deno.serve(async () => {
  try {
    const db = admin(), day = new Date().toISOString().slice(0, 10);
    const { data: last } = await db.from('price_days').select('updated_at').eq('day', day).maybeSingle();
    if (last && Date.now() - new Date(last.updated_at).getTime() < 6 * 3600e3) return json({ ok: true, skipped: 'ya actualizado', day });

    const groups = await get<TcgGroup[]>(`${CATEGORY}/groups`);
    const prices: DayPrices = {};
    for (const g of groups) {   // uno por uno: son ~15 sets y tcgcsv pide no saturarlo
      const [products, rows] = await Promise.all([get<any[]>(`${CATEGORY}/${g.groupId}/products`), get<any[]>(`${CATEGORY}/${g.groupId}/prices`)]);
      pricesForGroup(g, products, rows, prices);
    }
    const n = Object.keys(prices).length;
    if (n < 100) throw new Error(`muy pocos precios (${n}); no se guarda`);
    const { error } = await db.from('price_days').upsert({ day, prices, source: 'tcgplayer', updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    console.log(`precios ${day}: ${n} cartas de ${groups.length} sets`);
    return json({ ok: true, day, cards: n });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
