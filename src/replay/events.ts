// Detección de momentos importantes entre dos estados de un replay (sin DOM).

export interface CardRef { id: string; [k: string]: unknown }
export interface PlayerState { id: string; board?: Record<string, unknown> & { score?: number } }
export interface GameState { players: PlayerState[]; gameOutcome?: { winnerPlayerIds?: string[] } | null }

/** Puntos para ganar una partida de Riftbound. */
export const WIN_SCORE = 8;
/**
 * Quién ganó en este estado. Lo dice el juego (`gameOutcome`); si la partida se cortó sin cerrarse
 * (pasa al terminar o rendirse justo al llegar a los puntos), gana el único jugador con WIN_SCORE puntos o más.
 */
export function winnersOf(s: Partial<GameState> | null | undefined): string[] {
  const out = s?.gameOutcome?.winnerPlayerIds;
  if (out?.length) return out;
  const top = (s?.players || []).filter(p => (p.board?.score || 0) >= WIN_SCORE);
  return top.length === 1 ? [top[0].id] : [];
}

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
