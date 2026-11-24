// Intercambios: lo que te sobra de tu colección, lo que buscas para tus mazos y el cruce con la lista de otra persona.
// Todo es puro (sin DOM) para poder probarlo. La lista se comparte dentro de un enlace, sin servidor.
import type { Collection, Printing } from './model';
import { t as tr } from '../i18n/i18n';

/** Una carta en una lista de intercambio: impresión, acabado y copias. */
export interface TradeItem { code: string; finish: string; n: number }
/** Una carta que se busca: cualquier versión sirve, se guarda una impresión para mostrarla. */
export interface WantItem { code: string; n: number }
export interface TradeList { name: string; have: TradeItem[]; want: WantItem[] }

/** Cuántas copias de una carta te quedas antes de ofrecer las demás. */
export function keepFor(p: Pick<Printing, 'type'>): number {
  return p.type === 'Legend' || p.type === 'Battlefield' ? 1 : 3;
}
/** Cartas que nunca entran a la lista (runas básicas y fichas). */
const skip = (p: Printing) => p.token || p.type === 'Rune';
/** Las versiones especiales (arte alterno, foil…) se quedan primero: se ofrecen las copias más sencillas. */
const fancy = (p: Printing, finish: string) => (p.variant !== 'Normal' ? 2 : 0) + (finish !== 'normal' ? 1 : 0);

/**
 * Lo que te sobra: de cada carta (por nombre, juntando versiones y acabados) te quedas `keepFor` copias
 * y el resto se ofrece. `excluded`: nombres que no quieres cambiar.
 */
export function extras(col: Collection, byCode: Map<string, Printing>, keyOf: (p: Printing) => string, excluded = new Set<string>()): TradeItem[] {
  const groups = new Map<string, { p: Printing; finish: string; n: number }[]>();
  for (const [code, row] of Object.entries(col.items)) {
    const p = byCode.get(code); if (!p || skip(p)) continue;
    const k = keyOf(p); if (excluded.has(k)) continue;
    for (const [finish, n] of Object.entries(row)) if (n > 0) {
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push({ p, finish, n });
    }
  }
  const out: TradeItem[] = [];
  for (const rows of groups.values()) {
    let keep = keepFor(rows[0].p);
    // primero se quedan las especiales; lo que no cabe se ofrece
    rows.sort((a, b) => fancy(b.p, b.finish) - fancy(a.p, a.finish) || a.p.code.localeCompare(b.p.code));
    for (const r of rows) {
      const k = Math.min(keep, r.n); keep -= k;
      if (r.n - k > 0) out.push({ code: r.p.code, finish: r.finish, n: r.n - k });
    }
  }
  return out;
}

/** Lo que buscas: lo que te falta para tus mazos (por nombre), más lo que agregues a mano, menos lo que quites. */
export function wants(missing: { key: string; code: string; n: number }[], added: Record<string, { code: string; n: number }>, excluded = new Set<string>()): (WantItem & { key: string; manual?: boolean })[] {
  const by = new Map<string, WantItem & { key: string; manual?: boolean }>();
  for (const m of missing) if (m.n > 0 && !excluded.has(m.key)) by.set(m.key, { key: m.key, code: m.code, n: m.n });
  for (const [key, a] of Object.entries(added)) {
    if (a.n <= 0) continue;
    const o = by.get(key);
    by.set(key, { key, code: o?.code || a.code, n: Math.max(o?.n || 0, a.n), manual: true });
  }
  return [...by.values()];
}

/* ---------- enlace: n=nombre;h=COD.f*2,COD;w=COD*2 en base64url ---------- */
const FIN: Record<string, string> = { normal: '', foil: 'f', metal: 'm', 'metal-deluxe': 'd' };
const FIN_BACK: Record<string, string> = Object.fromEntries(Object.entries(FIN).map(([k, v]) => [v, k]));
const b64url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0)));

export function encodeTrade(t: TradeList): string {
  const h = t.have.map(x => `${x.code}${FIN[x.finish] ? '.' + FIN[x.finish] : ''}${x.n > 1 ? '*' + x.n : ''}`).join(',');
  const w = t.want.map(x => `${x.code}${x.n > 1 ? '*' + x.n : ''}`).join(',');
  return b64url(`n=${t.name.replace(/;/g, ',')};h=${h};w=${w}`);
}
export function decodeTrade(s: string): TradeList | null {
  try {
    const f = Object.fromEntries(unb64url(s).split(';').map(p => { const k = p.indexOf('='); return [p.slice(0, k), p.slice(k + 1)]; }));
    const items = (v: string) => (v ? v.split(',') : []).map(x => {
      const [cf, n] = x.split('*'), [code, fin] = cf.split('.');
      return { code: code.toUpperCase(), finish: FIN_BACK[fin || ''] || 'normal', n: Math.max(1, Math.min(99, +(n || 1) || 1)) };
    }).filter(x => /^[A-Z0-9*-]{3,16}$/.test(x.code));
    if (!('h' in f) && !('w' in f)) return null;
    return { name: (f.n || '').slice(0, 40), have: items(f.h), want: items(f.w).map(({ code, n }) => ({ code, n })) };
  } catch { return null; }
}

/* ---------- el cruce ---------- */
export interface Match { key: string; code: string; finish?: string; n: number }
/**
 * Lo que una lista le puede dar a la otra: de lo que `giver` ofrece, lo que `taker` busca (por nombre),
 * hasta las copias que busca.
 */
export function matchLists(giver: TradeItem[], taker: WantItem[], keyOfCode: (code: string) => string): Match[] {
  const need = new Map<string, number>();
  for (const w of taker) { const k = keyOfCode(w.code); need.set(k, (need.get(k) || 0) + w.n); }
  const out: Match[] = [];
  for (const h of giver) {
    const k = keyOfCode(h.code), left = need.get(k) || 0; if (!left) continue;
    const n = Math.min(left, h.n); need.set(k, left - n);
    out.push({ key: k, code: h.code, finish: h.finish, n });
  }
  return out;
}

/** Texto para mandar por WhatsApp: las dos listas (cortas) y el enlace. */
export function tradeText(t: TradeList, nameOf: (code: string) => string, url: string, max = 25): string {
  const fin = (f: string) => (f === 'normal' ? '' : ` (${f === 'foil' ? 'foil' : f})`);
  const lines = <T,>(xs: T[], fn: (x: T) => string) => [...xs.slice(0, max).map(fn), ...(xs.length > max ? [tr('…y {0} más', xs.length - max)] : [])];
  return [
    t.name ? tr('Intercambios de {0} (Riftbound)', t.name) : tr('Intercambios (Riftbound)'),
    '',
    t.have.length ? tr('Me sobran:') : '', ...lines(t.have, x => `${x.n} ${nameOf(x.code)}${fin(x.finish)}`),
    t.have.length ? '' : '',
    t.want.length ? tr('Busco:') : '', ...lines(t.want, x => `${x.n} ${nameOf(x.code)}`),
    '',
    tr('Ve qué nos podemos cambiar con tu colección: {0}', url),
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trim();
}
