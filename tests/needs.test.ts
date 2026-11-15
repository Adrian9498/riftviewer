import { describe, expect, it } from 'vitest';
import { deckNeeds, missingList, needsSummary, tcgplayerList } from '../src/collection/needs';

const key = (c: { name: string }) => c.name.toLowerCase().split(' - ').pop()!;
const price: Record<string, number> = { 'jinx, rebel': 2, 'stupefy': 0.5, "agony's embrace": 150 };
const priceOf = (_: unknown, k: string) => price[k] ?? null;

describe('lo que falta de un mazo', () => {
  const cards = [
    { code: 'RAD-175', name: "Evelynn - Agony's Embrace", n: 1 },
    { code: 'OGN-202', name: 'Jinx, Rebel', n: 2 },
    { code: 'OGN-202A', name: 'Jinx, Rebel', n: 1 },      // otra versión de la misma carta en el mazo
    { code: 'OGN-095', name: 'Stupefy', n: 3 },
    { code: 'X-001', name: 'Sin precio', n: 2 },
  ];
  const owned = new Map([['jinx, rebel', 2], ['stupefy', 5]]);
  const needs = deckNeeds(cards, owned, key, priceOf);

  it('reparte tus copias entre las filas con el mismo nombre', () => {
    expect(needs.map(x => [x.code, x.have, x.miss])).toEqual([
      ['RAD-175', 0, 1], ['OGN-202', 2, 0], ['OGN-202A', 0, 1], ['OGN-095', 3, 0], ['X-001', 0, 2],
    ]);
  });
  it('resume costo total, lo que falta y lo que no tiene precio', () => {
    expect(needsSummary(needs)).toEqual({ cost: 157.5, missCost: 152, missN: 4, unpriced: 2 });
  });
  it('junta las faltantes por carta, de la más cara a la más barata', () => {
    const m = missingList(needs);
    expect(m.map(x => [x.name, x.miss])).toEqual([["Evelynn - Agony's Embrace", 1], ['Jinx, Rebel', 1], ['Sin precio', 2]]);
  });
  it('lista para TCGplayer, con las leyendas como las escribe TCGplayer', () => {
    expect(tcgplayerList(missingList(needs))).toBe("1 Evelynn, Agony's Embrace\n1 Jinx, Rebel\n2 Sin precio");
  });
});
