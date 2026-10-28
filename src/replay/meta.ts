// Resumen corto de un replay para las tarjetas de "Recientes": jugadores, leyendas, marcador y ganador.
import { decodeReplay, type RawReplay } from './decode';
import { zoneCards } from './events';

export interface ReplayMetaPlayer {
  name: string;
  score: number;
  legendCode: string | null;
  legendName: string | null;
  winner: boolean;
}
export interface ReplayMeta {
  players: ReplayMetaPlayer[];
  turns: number | null;
  finished: boolean;
}

interface MetaPlayer { id: string; name?: string; seat?: number; board?: { score?: number; legend?: unknown } }
interface MetaState { players?: MetaPlayer[]; turnNumber?: number; gameOutcome?: { winnerPlayerIds?: string[] } | null }

export function replayMeta(json: RawReplay): ReplayMeta | null {
  const rp = decodeReplay<{ frames?: { state?: MetaState }[] }>(json);
  const frames = (rp?.frames || []).filter(f => f?.state?.players?.length);
  const last = frames[frames.length - 1]?.state;
  if (!last?.players) return null;
  const winners = new Set(last.gameOutcome?.winnerPlayerIds || []);
  const players = [...last.players].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0)).map(p => {
    const leg = zoneCards(p.board?.legend)[0] as { cardCode?: string; name?: string } | undefined;
    return {
      name: p.name || '',
      score: p.board?.score || 0,
      legendCode: leg?.cardCode || null,
      legendName: leg?.name || null,
      winner: winners.has(p.id),
    };
  });
  return { players, turns: typeof last.turnNumber === 'number' ? last.turnNumber : null, finished: winners.size > 0 };
}
