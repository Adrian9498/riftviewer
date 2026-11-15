// Colección de cartas: cuántas copias tienes de cada impresión ("RAD-001", "OGN-007a", "RAD-174*")
// y de cada acabado (normal, foil, metal…). Las impresiones salen del catálogo de OpenRift,
// que trae todas las versiones de cada set con su número impreso ("RAD-001/167").

export interface Printing {
  code: string;            // en mayúsculas: "RAD-001", "OGN-007A", "RAD-R01", "RAD-174*"
  name: string;
  set: string;             // "RAD"
  num: number;             // número dentro del set (sin prefijo ni letra)
  prefix: string;          // "", "R" (runas), "T" (fichas), "SP"
  suffix: string;          // "", "A", "B", "*"
  total: number | null;    // total impreso del set ("/167")
  rarity: string;          // Common, Uncommon, Rare, Epic, Showcase
  variant: string;         // Normal, Arte alterno, Firmada, Sobrenumerada, Ultimate
  finishes: string[];      // acabados que existen: normal, foil, metal, metal-deluxe
  type: string;            // Unit, Spell, Gear, Legend, Battlefield, Rune
  token: boolean;
  img: string;
  /** cuenta para el set base: numerada dentro del total, sin letra ni prefijo */
  base: boolean;
}
export interface CardSet { code: string; name: string; date: string; main: boolean }

export interface Collection {
  id: string;
  items: Record<string, Record<string, number>>;   // código → acabado → copias
  updatedAt: number;
}

export const FINISH_ES: Record<string, string> = { normal: 'Normal', foil: 'Foil', metal: 'Metal', 'metal-deluxe': 'Metal deluxe' };
const VARIANT_ES: Record<string, string> = { normal: 'Normal', altart: 'Arte alterno', ultimate: 'Ultimate' };
const cap = (s?: string) => s ? s[0].toUpperCase() + s.slice(1) : '';
const FINISH_ORDER = ['normal', 'foil', 'metal', 'metal-deluxe'];

interface RawPrinting {
  shortCode?: string; setId?: string; rarity?: string; artVariant?: string; isSigned?: boolean; isOvernumbered?: boolean;
  finish?: string; images?: { imageId: string }[]; publicCode?: string; language?: string; cardId: string; printedName?: string;
}
interface RawCard { name?: string; types?: string[]; superTypes?: string[] }
interface RawSet { id: string; slug: string; name: string; setType?: string; releases?: Record<string, { releasedAt?: string }> }
export interface RawCatalog { sets?: RawSet[]; cards?: Record<string, RawCard>; printings?: Record<string, RawPrinting> }

/** Divide "RAD-R01" / "OGN-007A" / "RAD-174*" en sus partes. */
export function splitCode(code: string) {
  const m = code.toUpperCase().match(/^([A-Z0-9]+)-(SP|R|T)?(\d+)([A-Z*]*)$/);
  return m ? { set: m[1], prefix: m[2] || '', num: +m[3], suffix: m[4] } : null;
}

/** Todas las impresiones en inglés del catálogo, una por código, con los acabados que existen. */
export function buildPrintings(cat: RawCatalog): { prints: Printing[]; sets: CardSet[] } {
  const cards = cat?.cards || {};
  const by = new Map<string, { p: Printing; s: number }>(), pending: RawPrinting[] = [];
  for (const r of Object.values(cat?.printings || {})) {
    if (r.language && r.language !== 'EN') continue;
    const c = cards[r.cardId], code = (r.shortCode || '').toUpperCase(), parts = splitCode(code), img = r.images?.[0]?.imageId;
    if (!c || !parts) continue;
    const type = (c.types || [])[0];
    if (!type || type === 'other') continue;            // marcadores (Buff, Empowered): no se coleccionan
    const total = +((r.publicCode || '').match(/\/(\d+)/)?.[1] || 0) || null;
    const variant = r.isSigned ? 'Firmada' : r.isOvernumbered ? 'Sobrenumerada' : VARIANT_ES[r.artVariant || 'normal'] || cap(r.artVariant);
    const score = (r.artVariant === 'normal' ? 4 : 0) + (r.finish === 'normal' ? 1 : 0);
    const old = by.get(code);
    if (old) {
      if (r.finish && !old.p.finishes.includes(r.finish)) old.p.finishes.push(r.finish);
      if (img && (score > old.s || !old.p.img)) { old.p.img = `https://openrift.app/media/cards/${img}-400w.webp`; old.s = score; }
      continue;
    }
    // una impresión sin imagen (las Metal Deluxe suelen venir así) solo suma su acabado a otra que sí la tenga
    if (!img) { pending.push(r); continue; }
    const token = (c.superTypes || []).includes('token');
    by.set(code, { s: score, p: {
      code, name: c.name || r.printedName || '', set: parts.set, num: parts.num, prefix: parts.prefix, suffix: parts.suffix, total,
      rarity: cap(r.rarity), variant, finishes: r.finish ? [r.finish] : ['normal'], type: cap(type), token,
      img: `https://openrift.app/media/cards/${img}-400w.webp`,
      base: !parts.prefix && !parts.suffix && !token && !r.isSigned && !r.isOvernumbered && !!total && parts.num <= total,
    } });
  }
  for (const r of pending) {
    const old = by.get((r.shortCode || '').toUpperCase());
    if (old && r.finish && !old.p.finishes.includes(r.finish)) old.p.finishes.push(r.finish);
  }
  const prints = [...by.values()].map(x => x.p);
  for (const p of prints) p.finishes.sort((a, b) => FINISH_ORDER.indexOf(a) - FINISH_ORDER.indexOf(b));
  prints.sort(comparePrintings);
  const have = new Set(prints.map(p => p.set));
  const sets = (cat?.sets || []).filter(s => have.has(s.slug)).map(s => ({
    code: s.slug, name: s.name, main: s.setType === 'main',
    date: s.releases?.EN?.releasedAt || Object.values(s.releases || {})[0]?.releasedAt || '',
  })).sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.code.localeCompare(b.code));
  return { prints, sets };
}
const PREFIX_ORDER: Record<string, number> = { '': 0, SP: 1, R: 2, T: 3 };
export function comparePrintings(a: Printing, b: Printing) {
  return a.set.localeCompare(b.set) || PREFIX_ORDER[a.prefix] - PREFIX_ORDER[b.prefix] || a.num - b.num || a.suffix.localeCompare(b.suffix);
}

/* ---------- colección ---------- */
export const emptyCollection = (id = 'mine'): Collection => ({ id, items: {}, updatedAt: Date.now() });

/** Suma (o resta) copias de un acabado; nunca baja de 0. Devuelve las copias que quedan. */
export function bump(col: Collection, code: string, finish: string, d: number): number {
  const k = code.toUpperCase(), row = col.items[k] || {};
  const n = Math.max(0, (row[finish] || 0) + d);
  if (n) row[finish] = n; else delete row[finish];
  if (Object.keys(row).length) col.items[k] = row; else delete col.items[k];
  col.updatedAt = Date.now();
  return n;
}
export function countOf(col: Collection, code: string, finish?: string): number {
  const row = col.items[code.toUpperCase()]; if (!row) return 0;
  return finish ? row[finish] || 0 : Object.values(row).reduce((a, b) => a + b, 0);
}

export interface Progress { have: number; total: number }
/** Progreso de un set: el set base (numeradas dentro del total) y todas sus versiones. */
export function setProgress(prints: Printing[], col: Collection, set: string) {
  const base: Progress = { have: 0, total: 0 }, all: Progress = { have: 0, total: 0 };
  let copies = 0;
  for (const p of prints) {
    if (p.set !== set) continue;
    const n = countOf(col, p.code);
    copies += n; all.total++; if (n) all.have++;
    if (p.base) { base.total++; if (n) base.have++; }
  }
  return { base, all, copies };
}
export const pct = (p: Progress) => p.total ? Math.floor(p.have * 100 / p.total) : 0;

/** Lista para exportar: "2 Amateur Demolitionist [RAD-001] (Foil)". */
export function collectionText(prints: Printing[], col: Collection): string {
  const byCode = new Map(prints.map(p => [p.code, p]));
  return Object.keys(col.items).sort().flatMap(code => Object.entries(col.items[code]).map(([f, n]) =>
    `${n} ${byCode.get(code)?.name ?? code} [${code}]${f === 'normal' ? '' : ` (${FINISH_ES[f] || f})`}`)).join('\n');
}

/* ---------- lectura del número con la cámara ---------- */
/**
 * Convierte el texto que leyó el OCR en impresiones posibles. Las cartas traen abajo "RAD • 001/167":
 * si el set no se lee bien, el total ("/167") dice de qué set es. Devuelve primero la lectura más probable.
 */
/** Códigos posibles para un número: "001" en el set, "R01" en runas, y "SP1" en las especiales (sin ceros). */
function baseCodes(set: string, prefix: string, num: string): string[] {
  const n = String(+num);
  if (prefix === 'SP') return [`${set}-SP${n}`, `${set}-SP${n.padStart(2, '0')}`];
  return [`${set}-${prefix}${n.padStart(prefix ? 2 : 3, '0')}`];
}
// cifras que el OCR suele leer en lugar de la letra de la versión ("a" chiquita, "b", "*")
const SUFFIX_LOOKALIKE: Record<string, string[]> = { 2: ['A'], 9: ['A'], 0: ['A'], 4: ['*', 'A'], 8: ['B'], 6: ['B'], 3: ['A', 'B'] };
export function parseCollectorText(text: string, prints: Printing[]): Printing[] {
  return parseCollector(text, prints).hits;
}
// índices por código y por total impreso, armados una sola vez por catálogo (el escáner lee varias veces por segundo)
const IDX = new WeakMap<Printing[], { byCode: Map<string, Printing>; totals: Map<number, Set<string>>; sets: Set<string> }>();
function indexOf(prints: Printing[]) {
  let i = IDX.get(prints);
  if (!i) {
    const totals = new Map<number, Set<string>>();
    for (const p of prints) if (p.total) { if (!totals.has(p.total)) totals.set(p.total, new Set()); totals.get(p.total)!.add(p.set); }
    i = { byCode: new Map(prints.map(p => [p.code, p])), totals, sets: new Set(prints.map(p => p.set)) };
    IDX.set(prints, i);
  }
  return i;
}
/**
 * Igual que parseCollectorText, y además dice si la lectura es segura: se leyó el set, existe,
 * y su total impreso coincide con el leído. Una lectura segura se acepta sin esperar a confirmarla.
 */
export function parseCollector(text: string, prints: Printing[]): { hits: Printing[]; sure: boolean } {
  const { byCode, totals, sets } = indexOf(prints);
  // errores típicos del OCR junto a números: O→0, I/L/|→1
  let fixed: string | false = false;
  const t = text.toUpperCase().replace(/\\/g, '/')
    .replace(/(?<=\d)[O]|[O](?=\d)/g, '0').replace(/(?<=\d)[IL|]|[IL|](?=\d)/g, '1')
    .replace(/\b5P(?=\d)/g, 'SP')                                         // "5P2" → "SP2"
    // la "/" leída como 7: "02927219" → "0292/219" (solo si lo de después es el total de algún set)
    .replace(/\b((?:SP|R|T)?\d{1,4}[A*]?)7(\d{3})\b/g, (m, a, b) => totals.has(+b) ? (fixed = `${a}/${b}`) : m)
    // la "/1" leída como un solo 7: "175767" → "175/167"
    .replace(/\b((?:SP|R|T)?\d{1,3}[A*]?)7(\d{2})\b/g, (m, a, b) => totals.has(+('1' + b)) && !totals.has(+b) ? (fixed = `${a}/1${b}`) : m);
  const hits: Printing[] = [];
  let sure = false;
  const push = (p?: Printing) => { if (p && !hits.includes(p)) hits.push(p); return !!p; };
  // el punto "•" entre set y número a veces se lee como "*"
  const re = /(?:\b([A-Z0-9]{3})\b[\s\-·•.:,*]*)?(SP|R|T)?\s?(\d{1,4})\s?([AB*]?)\s?\/\s?(\d{2,3})/g;
  for (const m of t.matchAll(re)) {
    const [, setTok, prefix = '', digits, suffix, totTok] = m;
    // 4 cifras: la última es la letra de la versión mal leída ("116a" → "1162", "229*" → "2294")
    const num = digits.length === 4 ? digits.slice(0, 3) : digits;
    const sufs = digits.length === 4 ? (SUFFIX_LOOKALIKE[digits[3]] || []) : [suffix];
    const total = +totTok, known = !!setTok && sets.has(setTok), match = known && !!totals.get(total)?.has(setTok);
    let cands = known ? [setTok] : [...(totals.get(total) || [])];
    if (known && !match && totals.get(total)) cands = [setTok, ...totals.get(total)!];
    for (const s of cands) {
      const first = hits.length === 0;
      let ok = false;
      for (const code of baseCodes(s, prefix, num)) {
        for (const sf of sufs) if (sf) ok = push(byCode.get(code + sf)) || ok;
        ok = push(byCode.get(code)) || ok;
      }
      // una lectura reparada (la "/" leída como 7, una letra como cifra) espera a repetirse
      if (first && ok && match && s === setTok && digits.length < 4 && !fixed) sure = true;
    }
  }
  // runas y fichas no llevan total: "RAD • R01 • EN". Solo se aceptan con el set leído (y nunca a la primera).
  // El OCR confunde 0/O y 1/l en "R01" ("ROL", "ROla"), así que aquí se corrigen aunque no haya cifras al lado.
  if (!hits.length) for (const m of t.matchAll(/\b([A-Z0-9]{3})\b[\s\-·•.:,*]*([RT])([0-9OQDIL|]{2})([AB]?)(?![0-9A-Z/])/g)) {
    const [, setTok, prefix, raw, suffix] = m;
    if (!sets.has(setTok)) continue;
    const num = raw.replace(/[OQD]/g, '0').replace(/[IL|]/g, '1');
    for (const code of baseCodes(setTok, prefix, num)) { if (suffix) push(byCode.get(code + suffix)); push(byCode.get(code)); }
  }
  return { hits, sure };
}

/** Otras versiones con el mismo número (normal, arte alterno, firmada…), para elegir la correcta. */
export function variantsOf(prints: Printing[], p: Printing): Printing[] {
  return prints.filter(x => x.set === p.set && x.num === p.num && x.prefix === p.prefix);
}

// cifras que el OCR confunde entre sí (el 3 sobre todo: lo lee como 8, 9 o 5)
const DIGIT_LOOKALIKE: Record<string, string> = {
  0: '869', 1: '74', 2: '37', 3: '8952', 4: '19', 5: '369', 6: '850', 7: '12', 8: '3690', 9: '3805',
};
// la confusión va en los dos sentidos: si el 5 se lee como 9, desde el 9 también hay que probar el 5
for (const [a, ds] of Object.entries(DIGIT_LOOKALIKE)) for (const b of ds) if (!DIGIT_LOOKALIKE[b].includes(a)) DIGIT_LOOKALIKE[b] += a;
/**
 * Cartas que podrían ser en realidad la leída: sus otras versiones y las del mismo set con una cifra confundida
 * ("RAD-038" → RAD-033, RAD-039, RAD-008…). El escáner decide entre ellas comparando el arte.
 */
export function lookalikes(prints: Printing[], p: Printing): Printing[] {
  const { byCode } = indexOf(prints), out = new Set(variantsOf(prints, p));
  const digits = String(p.num).padStart(p.prefix ? 2 : 3, '0');
  for (let i = 0; i < digits.length; i++) for (const d of DIGIT_LOOKALIKE[digits[i]] || '') {
    const n = +(digits.slice(0, i) + d + digits.slice(i + 1));
    if (!n) continue;
    for (const code of baseCodes(p.set, p.prefix, String(n))) {
      const q = byCode.get(code); if (!q) continue;
      for (const v of variantsOf(prints, q)) out.add(v);
    }
  }
  return [...out];
}

/** Búsqueda manual: "RAD 001", "rad-001a" o parte del nombre. */
export function searchPrintings(q: string, prints: Printing[], norm: (s: string) => string, limit = 12): Printing[] {
  const s = q.trim(); if (!s) return [];
  const m = s.toUpperCase().match(/^([A-Z0-9]{3})[\s\-]*(SP|R|T)?(\d{1,3})([AB*]?)$/);
  if (m) {
    const codes = baseCodes(m[1], m[2] || '', m[3]);
    const hit = prints.filter(p => codes.some(code => p.code === code + m[4] || p.code.startsWith(code) && splitCode(p.code)?.num === +m[3]));
    if (hit.length) return hit.slice(0, limit);
  }
  const k = norm(s);
  return prints.filter(p => norm(p.name).includes(k)).slice(0, limit);
}

/* ---------- cuándo aceptar una lectura del escáner ---------- */
export const GATE = {
  window: 6,        // lecturas recientes que votan
  goneMs: 1500,     // sin leer ningún número este tiempo = se sacó la carta del marco
  cooldownMs: 900,  // tras sumar una carta, tiempo mínimo antes de sumar otra (cambiar de carta lleva más que eso)
};
/**
 * Decide qué lecturas cuentan como "carta encontrada". El OCR falla seguido (reflejos, movimiento) y a veces
 * cambia un dígito, así que:
 * - una carta solo se vuelve a sumar después de sacarla del marco (un rato sin leer ningún número),
 * - en modo automático hacen falta 2 lecturas iguales entre las últimas (3 si es otra carta justo después de sumar una),
 * - y entre dos sumas automáticas hay un tiempo mínimo.
 */
export class ScanGate {
  votes: (string | null)[] = [];
  shown: string | null = null;    // última carta encontrada
  lastRead = 0;                   // última vez que se leyó algún número
  lastAdd = -Infinity;            // última suma automática
  get armed() { return !this.shown; }
  /** Devuelve el código aceptado, o null si todavía no. */
  feed(code: string | null, sure: boolean, now: number, auto: boolean): string | null {
    if (code && this.shown && now - this.lastRead > GATE.goneMs) this.shown = null;   // hubo un hueco largo: la carta se sacó
    this.votes.push(code); if (this.votes.length > GATE.window) this.votes.shift();
    if (!code) { if (now - this.lastRead > GATE.goneMs) this.shown = null; return null; }
    this.lastRead = now;
    if (code === this.shown) return null;                                             // la misma carta sigue en el marco
    const votes = this.votes.filter(x => x === code).length;
    const need = auto ? (this.shown ? 3 : 2) : (sure ? 1 : 2);
    if (votes < need) return null;
    if (auto && now - this.lastAdd < GATE.cooldownMs) return null;
    this.shown = code;
    if (auto) { this.lastAdd = now; this.votes = []; }
    return code;
  }
  /** Al elegir una carta a mano: cuenta como encontrada. */
  pick(code: string, now: number) { this.shown = code; this.lastRead = now; }
}
