// Carpeta pública: la foto de tu colección que se publica y se hojea como una carpeta de 9 cartas por hoja.
// Puro (sin DOM ni red) para poder probarlo. La foto lleva nombre e imagen de cada carta: la página de la carpeta
// no necesita cargar el catálogo.
import type { CardSet, Collection, Printing } from './model';

/** Una carta en la carpeta: impresión, acabado y copias. */
export interface BinderCard {
  c: string;        // código ("OGN-001A")
  nm: string;       // nombre
  i: string;        // id de la imagen en OpenRift
  s: string;        // set
  r: string;        // rareza
  v: string;        // versión (Normal, Arte alterno, Firmada…)
  f: string;        // acabado: normal, foil, metal, metal-deluxe
  n: number;        // copias
}
export interface BinderData { v: 1; sets: { c: string; n: string }[]; cards: BinderCard[] }
export type BinderMode = 'all' | 'special';

export const PER_PAGE = 9;
const IMG = /\/media\/cards\/([^/]+?)-\d+w\.webp$/;
/** URL de la imagen a partir del id guardado. */
export const binderImg = (id: string, w = 400) => id ? `https://openrift.app/media/cards/${id}-${w}w.webp` : '';
/** ¿Es especial? (arte alterno, firmada, foil o metal, o rareza épica o mayor) */
export const isSpecial = (x: Pick<BinderCard, 'v' | 'f' | 'r'>) =>
  x.v !== 'Normal' || x.f !== 'normal' || ['Epic', 'Showcase', 'Ultimate'].includes(x.r);

/**
 * Arma la foto: las cartas que tienes, en el orden de una carpeta (por set, de más viejo a más nuevo, y por número).
 * Sin runas básicas ni fichas. `mode: 'special'`: solo las especiales.
 */
export function buildBinder(col: Collection, byCode: Map<string, Printing>, sets: CardSet[], mode: BinderMode = 'all'): BinderData {
  const order = new Map([...sets].sort((a, b) => (a.date || '9').localeCompare(b.date || '9')).map((s, k) => [s.code, k]));
  const rows: { p: Printing; card: BinderCard }[] = [];
  for (const [code, row] of Object.entries(col.items)) {
    const p = byCode.get(code); if (!p || p.token || p.type === 'Rune') continue;
    for (const [f, n] of Object.entries(row)) {
      if (!(n > 0)) continue;
      const card: BinderCard = { c: p.code, nm: p.name, i: p.img.match(IMG)?.[1] || '', s: p.set, r: p.rarity, v: p.variant, f, n };
      if (mode === 'special' && !isSpecial(card)) continue;
      rows.push({ p, card });
    }
  }
  const FIN = ['normal', 'foil', 'metal', 'metal-deluxe'];
  rows.sort((a, b) => (order.get(a.p.set) ?? 99) - (order.get(b.p.set) ?? 99) || a.p.set.localeCompare(b.p.set)
    || a.p.prefix.localeCompare(b.p.prefix) || a.p.num - b.p.num || a.p.suffix.localeCompare(b.p.suffix)
    || FIN.indexOf(a.card.f) - FIN.indexOf(b.card.f));
  const used = new Set(rows.map(r => r.p.set));
  return {
    v: 1,
    sets: sets.filter(s => used.has(s.code)).sort((a, b) => (order.get(a.code) ?? 99) - (order.get(b.code) ?? 99)).map(s => ({ c: s.code, n: s.name })),
    cards: rows.map(r => r.card),
  };
}

/** Las hojas: de 9 en 9. */
export function binderPages<T>(cards: T[], per = PER_PAGE): T[][] {
  const out: T[][] = [];
  for (let k = 0; k < cards.length; k += per) out.push(cards.slice(k, k + per));
  return out.length ? out : [[]];
}

/** Resumen: copias, cartas distintas, valor total y las más valiosas (con `priceOf` del día). */
export function binderSummary(cards: BinderCard[], priceOf: (code: string, finish: string) => number | null, top = 3) {
  let copies = 0, value = 0, priced = 0;
  const each: { card: BinderCard; price: number }[] = [];
  for (const x of cards) {
    copies += x.n;
    const p = priceOf(x.c, x.f);
    if (p != null) { value += p * x.n; priced += x.n; each.push({ card: x, price: p }); }
  }
  each.sort((a, b) => b.price - a.price);
  return { copies, distinct: cards.length, value: Math.round(value * 100) / 100, priced, best: each.slice(0, top) };
}

/** Lee una foto que vino de la red: descarta lo que no tenga forma de carta. */
export function parseBinder(x: unknown): BinderData | null {
  const d = x as BinderData;
  if (!d || d.v !== 1 || !Array.isArray(d.cards)) return null;
  const cards = d.cards.filter(c => c && typeof c.c === 'string' && typeof c.nm === 'string' && c.n > 0)
    .map(c => ({ c: c.c, nm: c.nm, i: String(c.i || '').replace(/[^\w-]/g, ''), s: String(c.s || ''), r: String(c.r || ''), v: String(c.v || 'Normal'), f: String(c.f || 'normal'), n: Math.min(999, Math.floor(c.n)) }));
  const sets = (Array.isArray(d.sets) ? d.sets : []).filter(s => s && typeof s.c === 'string').map(s => ({ c: s.c, n: String(s.n || s.c) }));
  return { v: 1, sets, cards };
}

/** Un identificador corto y difícil de adivinar para el enlace. */
export function newSlug(rand: () => number = Math.random): string {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = ''; for (let k = 0; k < 10; k++) s += abc[Math.floor(rand() * abc.length)];
  return s;
}
