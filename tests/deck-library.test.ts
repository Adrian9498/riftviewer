// Tu colección de mazos: historial de versiones, récord, carpetas y filtros de la galería.
import { describe, expect, it } from 'vitest';
import { emptyDeck } from '../src/deck/model';
import {
  NO_FOLDER, addResult, deckCounts, diffCounts, duplicate, emptyFilter, filterDecks, folders, legendsIn, recordVersion, versionSize, winRate,
  type LibDeck,
} from '../src/deck/library';

const deck = (id: string, extra: Partial<LibDeck> = {}): LibDeck => ({ ...emptyDeck(id, id), ...extra });

describe('historial de versiones', () => {
  it('cuenta todas las cartas; el banquillo va aparte', () => {
    const d = deck('a', { legend: 'L1', champion: 'C1', main: { X: 3, C1: 1 }, runes: { R: 6 }, battlefields: ['B1', 'B2'], side: { X: 1 } });
    expect(deckCounts(d)).toEqual({ L1: 1, C1: 2, X: 3, R: 6, B1: 1, B2: 1, 'side:X': 1 });
  });
  it('anota qué entró y qué salió, la más nueva primero', () => {
    const d = deck('a', { main: { X: 3, Y: 2 } });
    const before = deckCounts(d);
    d.main = { X: 1, Z: 2 };
    expect(diffCounts(before, deckCounts(d))).toEqual({ add: { Z: 2 }, rm: { X: 2, Y: 2 } });
    expect(recordVersion(d, before, 100)).toBe(true);
    expect(d.history![0]).toEqual({ ts: 100, add: { Z: 2 }, rm: { X: 2, Y: 2 } });
    expect(versionSize(d.history![0])).toEqual({ added: 2, removed: 4 });
    // sin cambios no se guarda nada
    expect(recordVersion(d, deckCounts(d), 200)).toBe(false);
    expect(d.history).toHaveLength(1);
    // un mazo nuevo: la primera versión trae todas sus cartas
    const n = deck('n', { main: { X: 3 } });
    recordVersion(n, {}, 1);
    expect(n.history![0].add).toEqual({ X: 3 });
  });
});

describe('récord de partidas', () => {
  it('suma victorias y derrotas sin bajar de cero', () => {
    const d = deck('a');
    expect(winRate(d.record)).toBeNull();
    addResult(d, 'w'); addResult(d, 'w'); addResult(d, 'w'); addResult(d, 'l');
    expect(d.record).toEqual({ w: 3, l: 1 });
    expect(winRate(d.record)).toBe(0.75);
    addResult(d, 'l', -1); addResult(d, 'l', -1);
    expect(d.record).toEqual({ w: 3, l: 0 });
  });
});

describe('galería', () => {
  const info = (d: LibDeck) => ({
    A: { legendName: 'Jinx', doms: ['Fury', 'Chaos'], price: 120 },
    B: { legendName: 'Diana', doms: ['Mind', 'Chaos'], price: 80 },
    C: { legendName: 'Jinx', doms: ['Fury', 'Chaos'], price: null },
    D: { legendName: 'Ahri', doms: ['Mind', 'Calm'], price: 40 },
  } as Record<string, { legendName: string; doms: string[]; price: number | null }>)[d.id];
  const decks = [
    deck('A', { name: 'Jinx agresivo', folder: 'Torneo', updatedAt: 4, record: { w: 1, l: 3 } }),
    deck('B', { name: 'Diana control', folder: 'Torneo', updatedAt: 3, record: { w: 5, l: 1 } }),
    deck('C', { name: 'Jinx casual', folder: '  Casual ', updatedAt: 2 }),
    deck('D', { name: 'Ahri', updatedAt: 1, fav: true }),
  ];
  const ids = (f = {}) => filterDecks(decks, { ...emptyFilter(), ...f }, info).map(d => d.id);

  it('los favoritos van primero, luego los más recientes', () => {
    expect(ids()).toEqual(['D', 'A', 'B', 'C']);
  });
  it('ordena por nombre, precio y % de victorias', () => {
    expect(ids({ sort: 'name' })).toEqual(['D', 'B', 'A', 'C']);
    expect(ids({ sort: 'price' })).toEqual(['D', 'A', 'B', 'C']);
    expect(ids({ sort: 'winrate' })).toEqual(['D', 'B', 'A', 'C']);
  });
  it('filtra por carpeta, leyenda, dominios y búsqueda', () => {
    expect(folders(decks)).toEqual([{ name: 'Casual', n: 1 }, { name: 'Torneo', n: 2 }]);
    expect(ids({ folder: 'Torneo' })).toEqual(['A', 'B']);
    expect(ids({ folder: 'Casual' })).toEqual(['C']);
    expect(ids({ folder: NO_FOLDER })).toEqual(['D']);
    expect(legendsIn(decks, info)[0]).toEqual({ name: 'Jinx', n: 2 });
    expect(ids({ legend: 'Jinx' })).toEqual(['A', 'C']);
    expect(ids({ dom: new Set(['Mind']) })).toEqual(['D', 'B']);
    expect(ids({ dom: new Set(['Mind', 'Chaos']) })).toEqual(['B']);
    expect(ids({ q: 'diana' })).toEqual(['B']);       // por leyenda
    expect(ids({ q: 'casual' })).toEqual(['C']);      // por nombre o carpeta
  });
  it('duplicar copia las cartas y notas, pero empieza su propio récord e historial', () => {
    const c = duplicate({ ...decks[1], notes: 'mulligan agresivo', history: [{ ts: 1, add: {}, rm: {} }], fav: true }, 'Z', 9);
    expect(c).toMatchObject({ id: 'Z', name: 'Diana control (copia)', folder: 'Torneo', notes: 'mulligan agresivo', fav: false, history: [], createdAt: 9 });
    expect(c.record).toBeUndefined();
  });
});
