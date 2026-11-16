// Tu colección de mazos: favoritos, carpetas, filtros por leyenda y dominio, récord de partidas e historial de versiones.
// Todo va dentro del mismo mazo guardado (campos opcionales), así se sincroniza con la nube sin tablas nuevas
// y los mazos de antes siguen funcionando.
import { fullRecord, type ReplayAnalysis } from './analysis';
import type { Deck } from './model';

export interface Record_ { w: number; l: number }
/** Una versión: qué cartas entraron y salieron respecto a la anterior. */
export interface Version { ts: number; add: Record<string, number>; rm: Record<string, number> }

export interface LibDeck extends Deck {
  fav?: boolean;
  folder?: string;
  notes?: string;
  record?: Record_;
  history?: Version[];
  createdAt?: number;
  /** repeticiones guardadas en el mazo; el archivo va aparte (IndexedDB y la nube), aquí solo el resumen */
  replays?: DeckReplay[];
  /** partidas presenciales anotadas desde "En la mesa" */
  games?: TableGame[];
}

/** Una partida presencial: el resultado, la leyenda rival (si se escaneó) y las cartas suyas que se vieron. */
export interface TableGame {
  id: string;
  ts: number;
  result: 'w' | 'l';
  opp: { legendCode: string | null; legendName: string | null } | null;
  seen?: string[];
}

export interface DeckReplay {
  id: string;
  name: string;
  ts: number;
  size: number;
  meta: { players: { name: string; score: number; legendCode: string | null; legendName: string | null; winner: boolean }[]; turns: number | null; finished: boolean } | null;
  /** quién eras, el resultado, los rivales y las cartas que jugaste */
  analysis?: ReplayAnalysis;
  /** false = no se suma al récord */
  count?: boolean;
}
/** Clave del archivo de una repetición (en IndexedDB y en la sincronización de archivos). */
export const replayKey = (deckId: string, id: string) => `rep:${deckId}:${id}`;

export const HISTORY_MAX = 60;
/** Carpeta especial en los filtros: los mazos que no están en ninguna. */
export const NO_FOLDER = '\u0000';

/* ---------- historial de versiones ---------- */

/** Todas las cartas del mazo por código; las del banquillo van aparte con "side:". */
export function deckCounts(d: Deck): Record<string, number> {
  const out: Record<string, number> = {};
  const put = (k: string, n = 1) => { if (k && n > 0) out[k] = (out[k] || 0) + n; };
  if (d.legend) put(d.legend);
  if (d.champion) put(d.champion);
  for (const [c, n] of Object.entries(d.main)) put(c, n);
  for (const [c, n] of Object.entries(d.runes)) put(c, n);
  for (const b of d.battlefields) put(b);
  for (const [c, n] of Object.entries(d.side)) put('side:' + c, n);
  return out;
}

/** Qué cambió de `a` a `b`. */
export function diffCounts(a: Record<string, number>, b: Record<string, number>): { add: Record<string, number>; rm: Record<string, number> } {
  const add: Record<string, number> = {}, rm: Record<string, number> = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const d = (b[k] || 0) - (a[k] || 0);
    if (d > 0) add[k] = d; else if (d < 0) rm[k] = -d;
  }
  return { add, rm };
}

/**
 * Guarda una versión si el mazo cambió desde `before` (las cartas que tenía al empezar a editar).
 * Las más nuevas van primero. Devuelve true si hubo cambios.
 */
export function recordVersion(d: LibDeck, before: Record<string, number>, ts = Date.now()): boolean {
  const { add, rm } = diffCounts(before, deckCounts(d));
  if (!Object.keys(add).length && !Object.keys(rm).length) return false;
  d.history = [{ ts, add, rm }, ...(d.history || [])].slice(0, HISTORY_MAX);
  return true;
}

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
/** "+3 −2" de una versión. */
export const versionSize = (v: Version) => ({ added: sum(v.add), removed: sum(v.rm) });

/* ---------- récord ---------- */

export const games = (r?: Record_) => (r ? r.w + r.l : 0);
/** Porcentaje de victorias (0–1), o null sin partidas. */
export const winRate = (r?: Record_): number | null => (games(r) ? r!.w / games(r) : null);
/** Suma o resta una victoria o derrota (nunca baja de 0). */
export function addResult(d: LibDeck, kind: 'w' | 'l', delta: 1 | -1 = 1): Record_ {
  const r = { w: d.record?.w || 0, l: d.record?.l || 0 };
  r[kind] = Math.max(0, r[kind] + delta);
  d.record = r;
  return r;
}

/* ---------- carpetas ---------- */

export const cleanFolder = (s: string | null | undefined) => (s || '').trim().replace(/\s+/g, ' ').slice(0, 40);
/** Las carpetas que existen, con cuántos mazos tiene cada una, en orden alfabético. */
export function folders(decks: LibDeck[]): { name: string; n: number }[] {
  const m = new Map<string, number>();
  for (const d of decks) { const f = cleanFolder(d.folder); if (f) m.set(f, (m.get(f) || 0) + 1); }
  return [...m].map(([name, n]) => ({ name, n })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/* ---------- filtros y orden de la galería ---------- */

/** Lo que la galería necesita saber de cada mazo y que depende del catálogo y los precios. */
export interface DeckInfo { legendName: string; doms: string[]; price: number | null }
export type InfoOf = (d: LibDeck) => DeckInfo;

export interface LibFilter {
  q: string;
  folder: string;         // '' = todas; NO_FOLDER = sin carpeta
  legend: string;         // nombre de la leyenda ('' = todas)
  dom: Set<string>;       // dominios (el mazo debe tener todos los elegidos)
  sort: 'recent' | 'name' | 'price' | 'winrate';
}
export const emptyFilter = (): LibFilter => ({ q: '', folder: '', legend: '', dom: new Set(), sort: 'recent' });

/** Las leyendas de tus mazos, con cuántos mazos usa cada una (se agrupan por nombre: da igual la versión de la carta). */
export function legendsIn(decks: LibDeck[], info: InfoOf): { name: string; n: number }[] {
  const m = new Map<string, number>();
  for (const d of decks) { const n = info(d).legendName; if (n) m.set(n, (m.get(n) || 0) + 1); }
  return [...m].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}
/** Los dominios presentes en tus mazos. */
export function domainsIn(decks: LibDeck[], info: InfoOf): string[] {
  return [...new Set(decks.flatMap(d => info(d).doms))];
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Filtra y ordena: los favoritos siempre van primero. */
export function filterDecks(decks: LibDeck[], f: LibFilter, info: InfoOf): LibDeck[] {
  const q = fold(f.q.trim());
  const out = decks.filter(d => {
    const i = info(d);
    if (q && !fold(`${d.name} ${i.legendName} ${d.folder || ''}`).includes(q)) return false;
    if (f.folder === NO_FOLDER ? cleanFolder(d.folder) : f.folder && cleanFolder(d.folder) !== f.folder) return false;
    if (f.legend && i.legendName !== f.legend) return false;
    for (const x of f.dom) if (!i.doms.includes(x)) return false;
    return true;
  });
  const by: Record<LibFilter['sort'], (a: LibDeck, b: LibDeck) => number> = {
    recent: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
    name: (a, b) => (a.name || '').localeCompare(b.name || '', 'es'),
    // los que no tienen precio, al final
    price: (a, b) => (info(b).price ?? -1) - (info(a).price ?? -1),
    winrate: (a, b) => (winRate(fullRecord(b)) ?? -1) - (winRate(fullRecord(a)) ?? -1) || games(fullRecord(b)) - games(fullRecord(a)),
  };
  return out.sort((a, b) => Number(!!b.fav) - Number(!!a.fav) || by[f.sort](a, b) || (b.updatedAt || 0) - (a.updatedAt || 0));
}

/** Copia de un mazo para "Duplicar": mismas cartas, notas y carpeta; récord e historial nuevos. */
export function duplicate(d: LibDeck, id: string, now = Date.now()): LibDeck {
  const c: LibDeck = JSON.parse(JSON.stringify(d));
  c.id = id; c.name = `${d.name || 'Mazo'} (copia)`; c.fav = false; c.updatedAt = now; c.createdAt = now;
  delete c.record; c.history = [];
  delete c.replays;   // los archivos son del mazo original
  delete c.games;
  delete (c as { deleted?: boolean }).deleted; delete (c as { ts?: number }).ts;
  return c;
}
