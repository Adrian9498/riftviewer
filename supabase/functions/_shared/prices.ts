// Precios de TCGplayer para Riftbound, tomados de tcgcsv.com (gratis, se actualiza una vez al día ~20:00 UTC).
// Convierte sus productos al mismo código de carta que usa la app ("OGN-007A", "RAD-R02", "RAD-179*").

export const TCGCSV = 'https://tcgcsv.com/tcgplayer';
export const CATEGORY = 89;   // Riftbound: League of Legends Trading Card Game

export interface TcgGroup { groupId: number; abbreviation: string; name: string }
export interface TcgProduct { productId: number; name: string; groupId: number; extendedData?: { name: string; value: string }[] }
export interface TcgPrice { productId: number; marketPrice: number | null; lowPrice: number | null; subTypeName: string }

/** Precios de un día: código → [mercado normal, mínimo normal, mercado foil, mínimo foil, id de producto en TCGplayer]. */
export type DayPrices = Record<string, [number | null, number | null, number | null, number | null, number]>;

/** "007a/298" del set OGN → "OGN-007A"; "R02" → "RAD-R02"; "SP4/005" → "RAD-SP4". null si no es una carta. */
export function codeFor(abbreviation: string, number?: string | null): string | null {
  const set = (abbreviation || '').toUpperCase();
  const num = (number || '').split('/')[0].trim().toUpperCase();
  if (!/^[A-Z0-9]{2,6}$/.test(set) || !/^(SP|R|T)?\d{1,3}[A-Z*]*$/.test(num)) return null;
  return `${set}-${num}`;
}
const numberOf = (p: TcgProduct) => p.extendedData?.find(e => e.name === 'Number')?.value ?? null;
const money = (n: number | null | undefined) => (typeof n === 'number' && isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null);

/** Junta los productos y precios de un set en precios por código. Si dos productos comparten número, gana el primero. */
export function pricesForGroup(group: TcgGroup, products: TcgProduct[], prices: TcgPrice[], out: DayPrices = {}): DayPrices {
  const codeOf = new Map<number, string>();
  for (const p of products) {
    const code = codeFor(group.abbreviation, numberOf(p));
    if (code && !out[code] && ![...codeOf.values()].includes(code)) codeOf.set(p.productId, code);
  }
  for (const r of prices) {
    const code = codeOf.get(r.productId); if (!code) continue;
    const row = out[code] || (out[code] = [null, null, null, null, r.productId]);
    const foil = /foil/i.test(r.subTypeName);
    row[foil ? 2 : 0] = money(r.marketPrice) ?? money(r.lowPrice);
    row[foil ? 3 : 1] = money(r.lowPrice);
  }
  return out;
}
