// Precios de cartas (TCGplayer, en dólares) que guarda Supabase cada día en price_days.
// Se leen los del último día (una sola consulta, guardada en el navegador unas horas) y,
// al abrir una carta, su historial.
import { supabase } from './client';

/** código → [mercado normal, mínimo normal, mercado foil, mínimo foil, id de producto en TCGplayer] */
export type DayPrices = Record<string, [number | null, number | null, number | null, number | null, number]>;
export interface PriceDay { day: string; prices: DayPrices }

const CACHE = 'rb_prices1', MAX_AGE = 6 * 3600e3;
let latest: PriceDay | null = null;
let loading: Promise<PriceDay | null> | null = null;

/** Precio de mercado de una impresión y acabado (metal y metal deluxe usan el de foil). */
export function priceOf(day: DayPrices | null | undefined, code: string, finish = 'normal'): number | null {
  const r = day?.[code.toUpperCase()]; if (!r) return null;
  return (finish === 'normal' ? r[0] : r[2]) ?? null;
}
/** Valor de una colección (código → acabado → copias). priced: copias que tienen precio. */
export function collectionValue(day: DayPrices | null | undefined, items: Record<string, Record<string, number>>) {
  let value = 0, priced = 0, copies = 0;
  for (const [code, row] of Object.entries(items)) for (const [f, n] of Object.entries(row)) {
    copies += n; const p = priceOf(day, code, f);
    if (p != null) { value += p * n; priced += n; }
  }
  return { value: Math.round(value * 100) / 100, priced, copies };
}
export const tcgplayerUrl = (day: DayPrices | null | undefined, code: string) => {
  const id = day?.[code.toUpperCase()]?.[4]; return id ? `https://www.tcgplayer.com/product/${id}` : null;
};
// sin centavos desde $100 (mínimo y máximo de decimales tienen que coincidir: si el mínimo pasa al máximo, toLocaleString truena)
export const money = (n: number | null | undefined) => {
  if (n == null) return '—';
  const d = Math.abs(n) < 100 ? 2 : 0;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: d, maximumFractionDigits: d });
};

/** Precios del último día, o null si la nube no está configurada o aún no hay precios. */
export function latestPrices(): Promise<PriceDay | null> {
  if (latest) return Promise.resolve(latest);
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (c?.prices && Date.now() - c.t < MAX_AGE) { latest = { day: c.day, prices: c.prices }; return Promise.resolve(latest); }
  } catch { /* sin caché */ }
  const db = supabase(); if (!db) return Promise.resolve(null);
  return loading ??= (async () => {
    try {
      const { data, error } = await db.from('price_days').select('day, prices').order('day', { ascending: false }).limit(1).maybeSingle();
      if (error || !data) return null;
      latest = data as PriceDay;
      try { localStorage.setItem(CACHE, JSON.stringify({ ...latest, t: Date.now() })); } catch { /* sin espacio: solo en memoria */ }
      return latest;
    } finally { loading = null; }
  })();
}
/** Lo que ya está cargado, sin esperar (para pintar al instante). */
export const pricesNow = (): DayPrices | null => latest?.prices ?? null;

export interface HistoryRow { day: string; price: DayPrices[string] | null }
/** Historial de una carta (días con precio). */
export async function priceHistory(code: string, days = 365): Promise<HistoryRow[]> {
  const db = supabase(); if (!db) return [];
  const { data, error } = await db.rpc('card_price_history', { p_code: code.toUpperCase(), p_days: days });
  return error || !data ? [] : data as HistoryRow[];
}
/** Puntos de la gráfica para un acabado (se saltan los días sin precio). */
export function historyPoints(rows: HistoryRow[], finish = 'normal'): { day: string; v: number }[] {
  const i = finish === 'normal' ? 0 : 2;
  return rows.flatMap(r => r.price?.[i] != null ? [{ day: r.day, v: r.price[i] as number }] : []);
}

export interface ValueRow { day: string; value: number; priced: number }
/**
 * Valor de tu colección día por día (lo que tienes hoy, a los precios de cada día).
 * null si no hay nube o la función todavía no existe en Supabase (falta npx supabase db push).
 */
export async function collectionValueHistory(items: Record<string, Record<string, number>>, days = 365): Promise<ValueRow[] | null> {
  const db = supabase(); if (!db) return null;
  const { data, error } = await db.rpc('collection_value_history', { p_items: items, p_days: days });
  if (error || !data) return null;
  return (data as { day: string; value: number | string; priced: number }[]).map(r => ({ day: r.day, value: +r.value, priced: r.priced }));
}
/** Puntos de la gráfica del valor, desde una fecha (YYYY-MM-DD) si se da. */
export const valuePoints = (rows: ValueRow[], from = '') => rows.filter(r => r.day >= from).map(r => ({ day: r.day, v: r.value }));
