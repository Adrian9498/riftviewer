// Detección de momentos importantes entre dos estados de un replay (sin DOM).

export interface CardRef { id: string; [k: string]: unknown }
export interface PlayerState { id: string; board?: Record<string, unknown> & { score?: number } }
export interface GameState { players: PlayerState[] }

export const BATTLEFIELD_ZONES = ['battlefieldA', 'battlefieldB', 'battlefieldC', 'battlefieldToken'] as const;

/** Cartas de una zona: los replays guardan una lista, un objeto suelto o nada. */
export function zoneCards(x: unknown): CardRef[] {
  if (!x) return [];
  if (Array.isArray(x)) return x.filter((c): c is CardRef => !!c && typeof c === 'object' && 'id' in c && !!(c as CardRef).id);
  return typeof x === 'object' && (x as CardRef).id ? [x as CardRef] : [];
}

const playersIn = (s: GameState, zone: string) => s.players.filter(p => zoneCards(p.board?.[zone]).length).length;

/** Campos donde empieza una batalla: pasan a tener unidades de dos o más jugadores. */
export function newBattles(prev: GameState | null | undefined, next: GameState, zones: readonly string[] = BATTLEFIELD_ZONES): string[] {
  if (!prev) return [];
  return zones.filter(z => playersIn(next, z) >= 2 && playersIn(prev, z) < 2);
}

/** Cambio de puntos de cada jugador (solo los que cambiaron). */
export function scoreDeltas(prev: GameState | null | undefined, next: GameState): { id: string; delta: number }[] {
  if (!prev) return [];
  return next.players
    .map(p => ({ id: p.id, delta: (p.board?.score || 0) - (prev.players.find(q => q.id === p.id)?.board?.score || 0) }))
    .filter(d => d.delta !== 0);
}
