// Qué cartas de un mazo tienes en tu colección y cuáles te faltan.
// Para jugar sirve cualquier versión (normal, alterna, foil…), así que se cuenta por nombre de carta.

export interface DeckCard { code: string; name: string; n: number }
export interface Need extends DeckCard {
  key: string;            // nombre normalizado: junta las versiones de la misma carta
  have: number;           // copias tuyas asignadas a esta fila
  miss: number;           // las que faltan
  price: number | null;   // precio de la versión más barata (null: sin precio)
}

/**
 * Reparte tus copias entre las filas del mazo (si la misma carta aparece con dos códigos, primero se llena una)
 * y calcula lo que falta. keyOf: nombre normalizado de una carta del mazo. owned: copias por nombre normalizado.
 */
export function deckNeeds(cards: DeckCard[], owned: Map<string, number>, keyOf: (c: DeckCard) => string, priceOf: (c: DeckCard, key: string) => number | null): Need[] {
  const left = new Map(owned);
  return cards.filter(c => c.n > 0).map(c => {
    const key = keyOf(c), have = Math.min(c.n, left.get(key) || 0);
    left.set(key, (left.get(key) || 0) - have);
    return { ...c, key, have, miss: c.n - have, price: priceOf(c, key) };
  });
}

/** Resumen: costo total del mazo, lo que falta y su costo, y cuántas copias no tienen precio. */
export function needsSummary(needs: Need[]) {
  const r2 = (x: number) => Math.round(x * 100) / 100;
  let cost = 0, missCost = 0, missN = 0, unpriced = 0;
  for (const x of needs) {
    missN += x.miss;
    if (x.price == null) { unpriced += x.n; continue; }
    cost += x.price * x.n; missCost += x.price * x.miss;
  }
  return { cost: r2(cost), missCost: r2(missCost), missN, unpriced };
}

/** Las faltantes juntas por carta (dos filas con el mismo nombre se suman), de la más cara a la más barata. */
export function missingList(needs: Need[]): Need[] {
  const by = new Map<string, Need>();
  for (const x of needs) {
    if (!x.miss) continue;
    const o = by.get(x.key);
    if (o) { o.miss += x.miss; o.n += x.n; o.have += x.have; } else by.set(x.key, { ...x });
  }
  return [...by.values()].sort((a, b) => (b.price ?? -1) * b.miss - (a.price ?? -1) * a.miss || a.name.localeCompare(b.name));
}

/**
 * Lista para la "compra masiva" (Mass Entry) de TCGplayer: una carta por renglón, "2 Jinx, Rebel".
 * TCGplayer escribe las leyendas "Evelynn, Agony's Embrace"; riftcodex, "Evelynn - Agony's Embrace".
 */
export function tcgplayerList(missing: Need[]): string {
  return missing.map(x => `${x.miss} ${x.name.replace(/\s+-\s+/, ', ')}`).join('\n');
}
