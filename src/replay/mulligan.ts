// Mulligans de un replay: mano inicial, qué devolvió y qué robó cada jugador, y en qué jugada confirmó.
import { zoneCards, type CardRef } from './events';

interface Frame { actionType?: string; actorPlayerId?: string; state: { phase?: string; players: { id: string; board?: Record<string, unknown> }[]; mulliganDonePlayerIds?: string[] } }

export interface PlayerMulligan {
  initial: CardRef[];
  /** ids de las cartas de la mano inicial que devolvió */
  returned: string[];
  /** cartas nuevas que robó */
  drawn: CardRef[];
  /** jugada en la que confirmó su mulligan */
  doneAt: number;
}
export interface MulliganInfo {
  /** primera jugada del mulligan (manos iniciales repartidas) */
  start: number;
  /** primera jugada de la partida (todos confirmaron) */
  end: number;
  players: Record<string, PlayerMulligan>;
}

const hand = (f: Frame, pid: string) => zoneCards(f.state.players.find(p => p.id === pid)?.board?.hand);

export function computeMulligans(frames: Frame[]): MulliganInfo | null {
  const start = frames.findIndex(f => f.state.phase === 'mulligan');
  const end = frames.findIndex(f => f.state.phase === 'in_game');
  if (start < 0 || end < start) return null;
  const players: Record<string, PlayerMulligan> = {};
  for (const p of frames[start].state.players) {
    const initial = hand(frames[start], p.id), final = hand(frames[end], p.id);
    const finalIds = new Set(final.map(c => c.id)), initialIds = new Set(initial.map(c => c.id));
    let doneAt = frames.findIndex((f, i) => i >= start && ((f.actionType === 'submit_mulligan' && f.actorPlayerId === p.id) || (f.state.mulliganDonePlayerIds || []).includes(p.id)));
    if (doneAt < 0) doneAt = end;
    players[p.id] = { initial, returned: initial.filter(c => !finalIds.has(c.id)).map(c => c.id), drawn: final.filter(c => !initialIds.has(c.id)), doneAt };
  }
  return { start, end, players };
}
