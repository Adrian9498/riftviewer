// Lo que se aprende de un mazo: análisis de repeticiones, récord, probabilidades, versiones, comparar y reemplazos.
import { describe, expect, it } from 'vitest';
import {
  alternativesFor, analyzeReplay, baseCode, cardPerformance, compareCounts, countsAtVersion, deckFromCounts, fullRecord, matchups,
  legendKey, legendParts, pAny, pAnyMulligan, pNone,
} from '../src/deck/analysis';
import { deckCounts, recordVersion, type LibDeck } from '../src/deck/library';
import type { DCard } from '../src/deck/model';

const c = (id: string, code: string, type = 'unit') => ({ id, cardCode: code, name: code, type, source: 'mainDeck' });
const board = (z: Record<string, unknown> = {}) => ({ legend: [], champion: [], hand: [], base: [], trash: [], deck: [], battlefieldA: [], ...z });
const st = (phase: string, me: Record<string, unknown>, opp: Record<string, unknown> = {}, winners?: string[]) => ({
  state: {
    phase, gameOutcome: winners ? { winnerPlayerIds: winners } : null,
    players: [
      { id: 'yo', name: 'Yo', seat: 0, board: board({ legend: [c('L1', 'UNL-234', 'legend')], ...me }) },
      { id: 'el', name: 'Él', seat: 1, board: board({ legend: [{ ...c('L2', 'UNL-183', 'legend'), name: 'Rengar' }], ...opp }) },
    ],
  },
});

describe('análisis de una repetición', () => {
  // A: la robas y la juegas; B: la robas y se queda; C: hechizo que pasa por la cadena (desaparece) y llega a la pila de descarte;
  // D: vuelve al mazo (no cuenta como jugada); X: lo que pasa después de decidirse la partida no cuenta
  const frames = [
    st('mulligan', { hand: [c('a', 'OGN-010')] }),
    st('in_game', { hand: [c('a', 'OGN-010'), c('b', 'OGN-020'), c('d', 'OGN-040')], champion: [c('ch', 'UNL-079A')] }),
    st('in_game', { base: [c('a', 'OGN-010')], hand: [c('b', 'OGN-020'), c('c', 'OGN-030', 'spell')], deck: [c('d', 'OGN-040')], champion: [c('ch', 'UNL-079A')] }),
    st('in_game', { base: [c('a', 'OGN-010')], hand: [c('b', 'OGN-020')], champion: [c('ch', 'UNL-079A')] }),
    st('in_game', { battlefieldA: [c('a', 'OGN-010'), c('ch', 'UNL-079A')], trash: [c('c', 'OGN-030', 'spell')], hand: [c('b', 'OGN-020')] }, {}, ['el']),
    st('in_game', { hand: [c('b', 'OGN-020'), c('x', 'OGN-099')] }, {}, ['el']),
  ];
  const a = analyzeReplay({ viewerPlayerId: 'el', frames }, 'UNL-234');

  it('reconoce quién eras por la leyenda del mazo (aunque el replay lo haya descargado el rival)', () => {
    expect(a.me).toBe('yo');
    expect(a.result).toBe('l');
    expect(a.opp).toEqual([{ name: 'Él', legendCode: 'UNL-183', legendName: 'Rengar' }]);
  });
  it('cuenta por código base las cartas robadas, las jugadas y las que quedaron en la mano al decidirse la partida', () => {
    expect(a.cards).toEqual({ 'OGN-010': [1, 1, 0], 'OGN-020': [1, 0, 1], 'OGN-030': [1, 1, 0], 'OGN-040': [1, 0, 0], 'UNL-079': [1, 1, 0] });
  });
  it('sin leyenda que coincida usa al que descargó el replay; sin ganador no hay resultado', () => {
    const b = analyzeReplay({ viewerPlayerId: 'el', frames: frames.slice(0, 3) }, 'OGN-999');
    expect(b.me).toBe('el');
    expect(b.result).toBeNull();
  });
  it('baseCode quita la letra de la variante', () => {
    expect(baseCode('unl-079a')).toBe('UNL-079');
    expect(baseCode('RAD-174S')).toBe('RAD-174');
  });
});

describe('récord, leyendas rivales y rendimiento', () => {
  const rep = (id: string, result: 'w' | 'l', opp: string, cards: Record<string, [number, number, number?]>, count?: boolean) =>
    ({ id, name: id, ts: 1, size: 1, meta: null, count, analysis: { v: 1 as const, me: 'yo', meName: 'Yo', result, opp: [{ name: 'x', legendCode: opp, legendName: opp }], cards } });
  const reps = [
    rep('1', 'w', 'UNL-183', { A: [1, 1, 0], B: [1, 0, 1] }),
    rep('2', 'w', 'UNL-183', { A: [1, 1] }),
    rep('3', 'l', 'OGS-019', { B: [2, 1, 1] }),
    rep('4', 'l', 'OGS-019', { A: [1, 1] }, false),   // no cuenta en el récord
  ];
  it('el récord suma lo anotado a mano y las repeticiones que cuentan', () => {
    expect(fullRecord({ record: { w: 1, l: 0 }, replays: reps } as unknown as LibDeck)).toEqual({ w: 3, l: 1 });
  });
  it('contra cada leyenda', () => {
    // primero las leyendas contra las que más has jugado
    expect(matchups(reps).map(m => [m.legendName, m.w, m.l])).toEqual([['UNL-183', 2, 0], ['OGS-019', 0, 1]]);
  });
  it('cada carta: en cuántas partidas la jugaste, cómo te fue y cuántas copias te quedaron en la mano al terminar', () => {
    const p = cardPerformance(reps);
    expect(p.find(x => x.code === 'A')).toMatchObject({ games: 4, playedIn: 3, w: 2, l: 1, stuck: 0 });
    expect(p.find(x => x.code === 'B')).toMatchObject({ drawnIn: 2, playedIn: 1, w: 0, l: 1, stuck: 2 });
  });
  it('junta impresiones distintas de la misma carta', () => {
    const p = cardPerformance([rep('5', 'w', 'X', { 'OGN-1': [1, 1, 0], 'SFD-9': [1, 0, 1] })], c => (c === 'SFD-9' ? 'OGN-1' : c));
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ drawnIn: 1, playedIn: 1, w: 1, stuck: 1 });
  });
});

describe('leyendas: una sola por nombre, en cualquier impresión', () => {
  it('ignora la versión y si el nombre va con coma o con guion', () => {
    expect(legendKey('OGN-251', 'Jinx, Loose Cannon')).toBe(legendKey('OGN-301', 'Jinx - Loose Cannon (Signature)'));
    expect(legendKey('X', 'Master Yi - Wuju Master')).not.toBe(legendKey('Y', 'Master Yi - Wuju Bladesman'));
    expect(legendParts('Jinx - Loose Cannon (Metal)')).toEqual(['Jinx', 'Loose Cannon']);
    expect(legendParts('Diana, Scorn of the Moon')).toEqual(['Diana', 'Scorn of the Moon']);
  });
  it('el récord contra una leyenda junta replays y partidas en la mesa con otra impresión', () => {
    const rep = { id: '1', name: '1', ts: 1, size: 1, meta: null, analysis: { v: 2, me: 'yo', meName: 'Yo', result: 'w' as const, opp: [{ name: 'x', legendCode: 'OGN-251', legendName: 'Jinx, Loose Cannon' }], cards: {} } };
    const game = { id: 'g', ts: 2, result: 'l' as const, opp: { legendCode: 'OGN-301', legendName: 'Jinx - Loose Cannon (Signature)' } };
    expect(matchups([rep], [game]).map(m => [m.legendName, m.w, m.l])).toEqual([['Jinx, Loose Cannon', 1, 1]]);
  });
});

describe('probabilidades', () => {
  it('hipergeométrica', () => {
    expect(pNone(40, 0, 4)).toBe(1);
    expect(pAny(40, 3, 4)).toBeCloseTo(1 - (37 * 36 * 35 * 34) / (40 * 39 * 38 * 37), 10);
    expect(pAny(40, 3, 40)).toBe(1);
    // el mulligan ayuda
    expect(pAnyMulligan(40, 3)).toBeGreaterThan(pAny(40, 3, 4));
    expect(pAnyMulligan(40, 3)).toBeCloseTo(1 - pNone(40, 3, 4) * pNone(36, 3, 2), 10);
  });
});

describe('versiones y comparar', () => {
  const cards: Record<string, DCard> = {
    L: { code: 'L', name: 'Leyenda', type: 'Legend', sup: null, dom: ['Mind'], tags: ['x'], e: null, m: null, pw: null },
    CH: { code: 'CH', name: 'Campeón', type: 'Unit', sup: 'Champion', dom: ['Mind'], tags: ['x'], e: 3, m: 3, pw: null },
    S: { code: 'S', name: 'Hechizo', type: 'Spell', sup: null, dom: ['Mind'], tags: [], e: 1, m: null, pw: null },
    R: { code: 'R', name: 'Runa', type: 'Rune', sup: 'Basic', dom: ['Mind'], tags: [], e: null, m: null, pw: null },
    B: { code: 'B', name: 'Campo', type: 'Battlefield', sup: null, dom: [], tags: [], e: null, m: null, pw: null },
  };
  const get = (k: string) => cards[k];
  it('vuelve a una versión anterior y se puede deshacer', () => {
    const d: LibDeck = { id: 'd', name: 'D', legend: 'L', champion: 'CH', main: { S: 3, CH: 1 }, runes: { R: 12 }, battlefields: ['B'], side: {}, updatedAt: 1, history: [] };
    recordVersion(d, {});
    const before = deckCounts(d);
    d.main = { S: 1, CH: 2 }; d.side = { S: 1 };
    recordVersion(d, before);
    expect(d.history).toHaveLength(2);
    const old = deckFromCounts(d, countsAtVersion(deckCounts(d), d.history!, 1), get);
    expect(old).toMatchObject({ legend: 'L', champion: 'CH', main: { S: 3, CH: 1 }, runes: { R: 12 }, battlefields: ['B'], side: {} });
  });
  it('compara dos mazos', () => {
    expect(compareCounts({ A: 2, B: 1, 'side:C': 1 }, { A: 3, D: 1 })).toEqual({ onlyA: [['B', 1], ['side:C', 1]], onlyB: [['D', 1]], changed: [['A', 2, 3]] });
  });
});

describe('reemplazos', () => {
  const card = (code: string, name: string, e: number, dom: string[], sup: string | null = null, type = 'Spell'): DCard => ({ code, name, type, sup, dom, tags: [], e, m: null, pw: null });
  const cara = card('C1', 'Cara', 2, ['Mind']);
  const cat = [
    cara,
    card('C2', 'Barata', 2, ['Mind']),
    card('C3', 'La tengo', 3, ['Mind']),
    card('C4', 'Otro dominio', 2, ['Fury']),
    card('C5', 'Muy cara', 2, ['Mind']),
    card('C6', 'Firma', 2, ['Mind'], 'Signature'),
    card('C7', 'Muy lejos', 6, ['Mind']),
    card('C8', 'Ya en el mazo', 2, ['Mind']),
  ];
  const prices: Record<string, number> = { C2: 0.5, C3: 20, C4: 0.1, C5: 30, C6: 0.1, C7: 0.1, C8: 0.1 };
  it('mismo tipo, en tus dominios, energía parecida, y más barata o que ya tienes (primero las que tienes)', () => {
    const alts = alternativesFor(cara, 10, ['Mind', 'Chaos'], cat, new Set(['Ya en el mazo']), x => ({ price: prices[x.code] ?? null, owned: x.code === 'C3' ? 2 : 0 }));
    expect(alts.map(a => a.card.name)).toEqual(['La tengo', 'Barata']);
  });
});
