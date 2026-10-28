// Flechas de objetivo que registra RiftAtlas (por ejemplo, un hechizo en la cadena que apunta a una unidad).

export interface TargetArrow {
  owner: string;
  /** id de la carta de origen tal como la dibuja la app (la carta original, no la entrada de la cadena) */
  sourceKey: string;
  targetCardId: string;
  sourceAnchor: string;
  targetAnchor: string;
}

const CARD_ID = /card_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
/** RiftAtlas nombra el origen en la cadena como "chain-<jugador>-<card_…>-<uuid>": se extrae la carta original. */
export const sourceCardOf = (s: string): string => s.match(CARD_ID)?.[0] ?? s;

type RawArrow = { sourceAnchor?: string; sourceCardId?: string; targetAnchor?: string; targetCardId?: string };

export function targetArrows(state: { targetArrowsByPlayer?: Record<string, RawArrow[] | RawArrow | null> }): TargetArrow[] {
  const out: TargetArrow[] = [];
  for (const [owner, v] of Object.entries(state.targetArrowsByPlayer || {})) {
    for (const a of !v ? [] : Array.isArray(v) ? v : [v]) {
      if (!a?.sourceCardId || !a.targetCardId) continue;
      out.push({ owner, sourceKey: sourceCardOf(a.sourceCardId), targetCardId: a.targetCardId, sourceAnchor: a.sourceAnchor || '', targetAnchor: a.targetAnchor || '' });
    }
  }
  return out;
}

/** Clave para saber si las flechas cambiaron entre dos jugadas. */
export const arrowsKey = (as: TargetArrow[]): string => as.map(a => `${a.sourceKey}>${a.targetCardId}`).sort().join('|');
