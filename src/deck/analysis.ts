// Lo que se aprende de un mazo:
// - de sus repeticiones: quién eras, si ganaste, contra qué leyendas y qué cartas robaste y jugaste;
// - del mazo mismo: probabilidades de robo, volver a una versión anterior y comparar con otro mazo;
// - de los precios y tu colección: reemplazos más baratos o que ya tienes.
// Todo es puro (sin DOM) para poder probarlo.
import type { DCard, Deck } from './model';
import type { DeckReplay, LibDeck, TableGame, Version } from './library';
import { inIdentity } from './rules';
import { winnersOf, type GameState } from '../replay/events';

/** Código sin la letra de la variante ("UNL-079A" → "UNL-079"), para comparar impresiones. */
export const baseCode = (c: string | null | undefined) => (c || '').toUpperCase().replace(/[A-Z*]+$/, '');

/** Nombre de la leyenda sin la versión: "Jinx, Loose Cannon (Signature)" → "Jinx, Loose Cannon". */
export const legendName = (n: string | null | undefined) => (n || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
/**
 * La misma leyenda en cualquier impresión cuenta como una sola (por nombre; sin nombre, por código base).
 * Se ignoran signos: Riftcodex escribe "Jinx - Loose Cannon" y los replays "Jinx, Loose Cannon".
 */
export const legendKey = (code: string | null | undefined, name: string | null | undefined) =>
  legendName(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() || baseCode(code);
/** Campeón y título de una leyenda: "Jinx - Loose Cannon" o "Jinx, Loose Cannon" → ["Jinx", "Loose Cannon"]. */
export function legendParts(n: string | null | undefined): [string, string] {
  const s = legendName(n), m = s.match(/^(.*?)\s+-\s+(.*)$/) || s.match(/^(.*?),\s*(.*)$/);
  return m ? [m[1], m[2]] : [s, ''];
}

/* =============== repeticiones =============== */

interface RCard { id: string; cardCode?: string; name?: string; type?: string; source?: string }
interface RPlayer { id: string; name?: string; seat?: number; board?: Record<string, unknown> }
interface RState {
  phase?: string; players: RPlayer[]; gameOutcome?: { winnerPlayerIds?: string[] } | null;
  seriesStartedAt?: number; gameNumber?: number; winsByPlayerId?: Record<string, number>;
}
export interface RFrame { state: RState }
export interface RRoot { viewerPlayerId?: string; frames?: RFrame[] }

export interface ReplayOpp { name: string; legendCode: string | null; legendName: string | null }
/** Lo que se guarda de cada repetición para las estadísticas (el archivo no se vuelve a leer). */
export interface ReplayAnalysis {
  v: number;
  /** id del jugador que eras tú */
  me: string | null;
  meName: string | null;
  result: 'w' | 'l' | null;
  opp: ReplayOpp[];
  /**
   * por código base: [copias que llegaron a tu mano (o tu campeón), copias que jugaste,
   * copias que tenías en la mano al terminar la partida]
   */
  cards: Record<string, [number, number, number?]>;
  /**
   * La serie (mejor de 3) a la que pertenece: misma clave en todas sus partidas, el número de partida y cuántas
   * llevaba ganadas cada jugador al empezarla. Sirve para saber quién ganó una partida que no lo marca.
   */
  series?: { key: string; game: number; wins: Record<string, number> };
}
export const ANALYSIS_V = 4;

const cardsIn = (x: unknown): RCard[] => !x ? [] : Array.isArray(x) ? x.filter(c => c && c.id) : (x as RCard).id ? [x as RCard] : [];
const legendOf = (p?: RPlayer) => cardsIn(p?.board?.legend)[0];
const PLAY_ZONES = new Set(['base', 'battlefieldA', 'battlefieldB', 'battlefieldC', 'battlefieldToken', 'trash', 'banished']);
const FROM_ZONES = new Set(['hand', 'champion']);
const countable = (c: RCard) => !['legend', 'rune', 'battlefield'].includes((c.type || '').toLowerCase()) && !/token/i.test(c.source || '');

/**
 * Analiza una repetición ya decodificada. `deckLegend` ayuda a saber cuál jugador eras:
 * el que usaba la misma leyenda que el mazo; si no se puede saber, el que descargó el replay.
 */
export function analyzeReplay(rp: RRoot, deckLegend?: string | null): ReplayAnalysis {
  const all = (rp.frames || []).filter(f => f?.state?.players?.length);
  const out: ReplayAnalysis = { v: ANALYSIS_V, me: null, meName: null, result: null, opp: [], cards: {} };
  if (!all.length) return out;
  // hasta que se decide la partida (lo de después no cuenta)
  const decided = all.findIndex(f => winnersOf(f.state as GameState).length);
  const frames = decided >= 0 ? all.slice(0, decided + 1) : all;
  const last = frames[frames.length - 1].state;
  const players = [...last.players].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
  const byLegend = deckLegend ? players.filter(p => baseCode(legendOf(p)?.cardCode) === baseCode(deckLegend)) : [];
  const me = byLegend.length === 1 ? byLegend[0] : players.find(p => p.id === rp.viewerPlayerId) || null;
  if (!me) return out;
  out.me = me.id; out.meName = me.name || null;
  const winners = winnersOf(last as GameState);
  out.result = winners.length ? (winners.includes(me.id) ? 'w' : 'l') : null;
  const first = all[0].state;
  if (first.seriesStartedAt && first.gameNumber) out.series = {
    key: `${first.seriesStartedAt}|${players.map(p => p.id).sort().join(',')}`, game: first.gameNumber, wins: { ...(first.winsByPlayerId || {}) },
  };
  out.opp = players.filter(p => p.id !== me.id).map(p => { const l = legendOf(p); return { name: p.name || '', legendCode: l?.cardCode || null, legendName: l?.name || null }; });

  // cada carta (por su id) desde que empieza la partida: si llegó a la mano y si salió de ahí a la mesa
  const seen = new Map<string, { code: string; drawn: boolean; played: boolean; at: string }>();
  let lastHand: RCard[] = [];
  for (const f of frames) {
    if (f.state.phase !== 'in_game') continue;
    const p = f.state.players.find(x => x.id === me.id); if (!p?.board) continue;
    lastHand = cardsIn(p.board.hand);
    for (const [zone, v] of Object.entries(p.board)) {
      for (const c of cardsIn(v)) {
        if (!c.cardCode || !countable(c)) continue;
        let s = seen.get(c.id);
        if (!s) { s = { code: baseCode(c.cardCode), drawn: false, played: false, at: zone }; seen.set(c.id, s); }
        if (FROM_ZONES.has(zone)) s.drawn = true;
        else if (PLAY_ZONES.has(zone) && FROM_ZONES.has(s.at)) s.played = true;
        s.at = zone;
      }
    }
  }
  for (const s of seen.values()) {
    if (!s.drawn && !s.played) continue;
    const r = out.cards[s.code] || (out.cards[s.code] = [0, 0, 0]);
    if (s.drawn) r[0]++; if (s.played) r[1]++;
  }
  // lo que te quedó en la mano cuando se decidió la partida
  for (const c of lastHand) {
    if (!c.cardCode || !countable(c)) continue;
    const r = out.cards[baseCode(c.cardCode)] || (out.cards[baseCode(c.cardCode)] = [1, 0, 0]);
    r[2] = (r[2] || 0) + 1;
  }
  return out;
}

/**
 * El resultado de una repetición: el que marcaste a mano; si no, el de la partida; si no lo marca (se cortó o
 * alguien se rindió), lo que dice la siguiente partida de la misma serie: quién sumó una victoria entre las dos.
 * `all`: las demás repeticiones del mazo.
 */
export function replayResult(r: DeckReplay, all: DeckReplay[] = []): 'w' | 'l' | null {
  if (r.manual) return r.manual;
  const a = r.analysis; if (!a) return null;
  if (a.result) return a.result;
  const s = a.series; if (!s || !a.me) return null;
  const next = all.find(x => x.analysis?.series?.key === s.key && x.analysis.series.game === s.game + 1)?.analysis!.series!;
  if (!next) return null;
  const up = Object.keys(next.wins).filter(id => (next.wins[id] || 0) > (s.wins[id] || 0));
  return up.length === 1 ? (up[0] === a.me ? 'w' : 'l') : null;
}
const counted = (r: DeckReplay, all: DeckReplay[]) => replayResult(r, all) && r.count !== false;
/** Récord total: lo anotado a mano más las repeticiones que cuentan. */
export function fullRecord(d: LibDeck): { w: number; l: number } {
  const r = { w: d.record?.w || 0, l: d.record?.l || 0 };
  for (const x of d.replays || []) if (counted(x, d.replays!)) r[replayResult(x, d.replays)!]++;
  for (const g of d.games || []) r[g.result]++;
  return r;
}

export interface Matchup { key: string; legendCode: string | null; legendName: string; w: number; l: number }
/** Victorias y derrotas contra cada leyenda rival (de las repeticiones que cuentan y de las partidas en la mesa con leyenda). */
export function matchups(reps: DeckReplay[], games: TableGame[] = []): Matchup[] {
  const by = new Map<string, Matchup>();
  const add = (o: { legendCode: string | null; legendName: string | null }, res: 'w' | 'l') => {
    const name = legendName(o.legendName) || 'Leyenda desconocida', key = legendKey(o.legendCode, o.legendName) || name;
    const m = by.get(key) || { key, legendCode: o.legendCode, legendName: name, w: 0, l: 0 };
    m[res]++; by.set(key, m);
  };
  for (const r of reps) if (counted(r, reps) && r.analysis) for (const o of r.analysis.opp) add(o, replayResult(r, reps)!);
  for (const g of games) if (g.opp) add(g.opp, g.result);
  return [...by.values()].sort((a, b) => (b.w + b.l) - (a.w + a.l) || a.legendName.localeCompare(b.legendName));
}

export interface CardPerf {
  code: string;
  /** partidas analizadas */
  games: number;
  /** partidas en que la robaste y en que la jugaste */
  drawnIn: number;
  playedIn: number;
  /** victorias y derrotas en las partidas en que la jugaste */
  w: number; l: number;
  /** copias que tenías en la mano al terminar, sumando todas las partidas */
  stuck: number;
}
/**
 * Rendimiento de cada carta en las repeticiones analizadas (las que tienen resultado).
 * `keyOf` junta códigos de la misma carta (por ejemplo, por nombre); por defecto, el código base.
 */
export function cardPerformance(reps: DeckReplay[], keyOf: (code: string) => string = c => c): CardPerf[] {
  const done = reps.filter(r => r.analysis && replayResult(r, reps));
  const by = new Map<string, CardPerf>();
  for (const r of done) {
    // primero se junta lo de esta partida por carta, para contar partidas (no copias)
    const game = new Map<string, { code: string; drawn: number; played: number; end: number }>();
    for (const [code, [drawn, played, end = 0]] of Object.entries(r.analysis!.cards)) {
      const k = keyOf(code), g = game.get(k) || { code, drawn: 0, played: 0, end: 0 };
      g.drawn += drawn; g.played += played; g.end += end; game.set(k, g);
    }
    for (const [k, g] of game) {
      const p = by.get(k) || { code: g.code, games: done.length, drawnIn: 0, playedIn: 0, w: 0, l: 0, stuck: 0 };
      if (g.drawn) p.drawnIn++;
      if (g.played) { p.playedIn++; p[replayResult(r, reps)!]++; }
      p.stuck += g.end;
      by.set(k, p);
    }
  }
  return [...by.values()].sort((a, b) => b.playedIn - a.playedIn || b.drawnIn - a.drawnIn || a.code.localeCompare(b.code));
}

/* =============== probabilidades =============== */

export const OPENING_HAND = 4, MULLIGAN_MAX = 2;
/** Probabilidad de NO ver ninguna de K copias en n cartas de un mazo de N (sin reposición). */
export function pNone(N: number, K: number, n: number): number {
  if (K <= 0) return 1;
  n = Math.min(n, N);
  let p = 1;
  for (let i = 0; i < n; i++) p *= Math.max(0, N - K - i) / (N - i);
  return p;
}
export const pAny = (N: number, K: number, n: number) => 1 - pNone(N, K, n);
/**
 * Con mulligan buscándola: si no está en la mano inicial, devuelves hasta 2 cartas (van al fondo)
 * y robas otras tantas del resto del mazo.
 */
export const pAnyMulligan = (N: number, K: number, hand = OPENING_HAND, mull = MULLIGAN_MAX) =>
  1 - pNone(N, K, hand) * pNone(N - hand, K, mull);

/* =============== versiones =============== */

/** Las cartas que tenía el mazo en la versión `k` del historial (0 = la más reciente = el mazo actual). */
export function countsAtVersion(current: Record<string, number>, history: Version[], k: number): Record<string, number> {
  const out = { ...current };
  for (let i = 0; i < k && i < history.length; i++) {
    for (const [c, n] of Object.entries(history[i].add)) out[c] = (out[c] || 0) - n;
    for (const [c, n] of Object.entries(history[i].rm)) out[c] = (out[c] || 0) + n;
  }
  for (const c of Object.keys(out)) if (out[c] <= 0) delete out[c];
  return out;
}

/** Arma de nuevo las secciones del mazo a partir de sus cartas por código (como las guarda el historial). */
export function deckFromCounts<T extends Deck>(d: T, counts: Record<string, number>, get: (code: string) => DCard | undefined): T {
  const out: T = { ...d, legend: null, champion: null, main: {}, runes: {}, battlefields: [], side: {} };
  const units: string[] = [];
  for (const [k, n] of Object.entries(counts)) {
    if (k.startsWith('side:')) { out.side[k.slice(5)] = n; continue; }
    const c = get(k);
    if (c?.type === 'Legend') out.legend = k;
    else if (c?.type === 'Rune') out.runes[k] = n;
    else if (c?.type === 'Battlefield') for (let i = 0; i < n; i++) out.battlefields.push(k);
    else { out.main[k] = n; if (c?.type === 'Unit' && c.sup === 'Champion') units.push(k); }
  }
  // el campeón elegido es una copia de una unidad campeón: el de antes si sigue, si no el primero que haya
  const champ = d.champion && out.main[d.champion] ? d.champion : units[0] || null;
  if (champ) { out.champion = champ; if (--out.main[champ] <= 0) delete out.main[champ]; }
  return out;
}

export interface DeckDiff { onlyA: [string, number][]; onlyB: [string, number][]; changed: [string, number, number][] }
/** Diferencias entre dos mazos (por código, con el banquillo aparte). */
export function compareCounts(a: Record<string, number>, b: Record<string, number>): DeckDiff {
  const out: DeckDiff = { onlyA: [], onlyB: [], changed: [] };
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k] || 0, y = b[k] || 0;
    if (x && !y) out.onlyA.push([k, x]); else if (y && !x) out.onlyB.push([k, y]); else if (x !== y) out.changed.push([k, x, y]);
  }
  return out;
}

/* =============== reemplazos =============== */

export interface AltInfo { price: number | null; owned: number }
export interface Alternative { card: DCard; price: number | null; owned: number; score: number }
/**
 * Cartas que pueden tomar el lugar de `card`: mismo tipo, dentro de los dominios de la leyenda,
 * energía parecida, que no estén ya en el mazo y que sean más baratas o que ya tengas.
 */
export function alternativesFor(card: DCard, cardPrice: number | null, identity: string[], catalog: DCard[], inDeck: Set<string>, info: (c: DCard) => AltInfo, max = 3): Alternative[] {
  const e = card.e ?? 0, out: Alternative[] = [];
  for (const c of catalog) {
    if (c.type !== card.type || c.sup === 'Champion' || c.sup === 'Signature' || c.sup === 'Token' || c.sup === 'Basic') continue;
    if (inDeck.has(c.name) || c.name === card.name || !inIdentity(c, identity)) continue;
    if (Math.abs((c.e ?? 0) - e) > 1) continue;
    const { price, owned } = info(c);
    const cheaper = price != null && cardPrice != null && price < cardPrice * 0.8;
    if (!owned && !cheaper) continue;
    // primero las que ya tienes, luego las de energía igual y las más baratas
    const score = (owned ? 100 : 0) + (c.e === card.e ? 20 : 0) + (c.dom.some(d => card.dom.includes(d)) ? 10 : 0) - (price ?? 50);
    out.push({ card: c, price, owned, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, max);
}
