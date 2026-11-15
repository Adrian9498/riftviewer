// Estadísticas de un mazo: curva de energía, tipos, dominios y probabilidades de robo.
import { type CardLookup, type Deck, mainWithChampion, total } from './model';

export interface DeckStats {
  curve: number[];                     // cartas por costo de energía: 0,1,…,7+
  types: Record<string, number>;
  domains: Record<string, number>;
  avgCost: number;
  might: number;                       // poder total de las unidades
}

export function deckStats(d: Deck, get: CardLookup): DeckStats {
  const curve = new Array(8).fill(0), types: Record<string, number> = {}, domains: Record<string, number> = {};
  let costSum = 0, costN = 0, might = 0;
  for (const [code, n] of Object.entries(mainWithChampion(d))) {
    const c = get(code); if (!c) continue;
    types[c.type] = (types[c.type] || 0) + n;
    for (const dm of c.dom.length ? c.dom : ['Sin dominio']) domains[dm] = (domains[dm] || 0) + n;
    if (c.e != null) { curve[Math.min(7, c.e)] += n; costSum += c.e * n; costN += n; }
    if (c.type === 'Unit' && c.m != null) might += c.m * n;
  }
  return { curve, types, domains, avgCost: costN ? costSum / costN : 0, might };
}

/** combinaciones n sobre k (con números de punto flotante: alcanza para mazos de cartas) */
function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k); let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}
/** Probabilidad de ver al menos una de `copies` cartas al robar `seen` cartas de un mazo de `size`. */
export function atLeastOne(size: number, copies: number, seen: number): number {
  if (size <= 0 || copies <= 0) return 0;
  seen = Math.min(seen, size);
  return 1 - choose(size - copies, seen) / choose(size, seen);
}

export const OPENING_HAND = 4;
/** cartas vistas al empezar tu turno n (mano inicial de 4 y una por turno; sin contar el mulligan) */
export const seenByTurn = (n: number) => OPENING_HAND + Math.max(0, n - 1);
export const mainSize = (d: Deck) => total(mainWithChampion(d)) - (d.champion ? 1 : 0);   // el campeón empieza en su zona, no en el mazo
