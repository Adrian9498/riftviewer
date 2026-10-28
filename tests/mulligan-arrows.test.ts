import { describe, expect, it } from 'vitest';
import { computeMulligans } from '../src/replay/mulligan';
import { arrowsKey, sourceCardOf, targetArrows } from '../src/replay/arrows';

const c = (id: string) => ({ id, name: id });
const frame = (phase: string, hands: Record<string, string[]>, extra: object = {}) => ({
  ...extra,
  state: { phase, players: Object.entries(hands).map(([id, h]) => ({ id, board: { hand: h.map(c) } })), mulliganDonePlayerIds: (extra as any).done || [] },
});

describe('computeMulligans', () => {
  const frames = [
    frame('sideboarding', { a: [], b: [] }),
    frame('mulligan', { a: ['a1', 'a2', 'a3', 'a4'], b: ['b1', 'b2', 'b3', 'b4'] }),
    frame('mulligan', { a: ['a1', 'a2', 'a3', 'a4'], b: ['b1', 'b2', 'b5', 'b6'] }, { actionType: 'submit_mulligan', actorPlayerId: 'b', done: ['b'] }),
    frame('in_game', { a: ['a1', 'a2', 'a3', 'a4'], b: ['b1', 'b2', 'b5', 'b6'] }, { actionType: 'submit_mulligan', actorPlayerId: 'a' }),
  ];
  const m = computeMulligans(frames)!;

  it('ubica el inicio y el fin del mulligan', () => {
    expect([m.start, m.end]).toEqual([1, 3]);
  });
  it('calcula qué devolvió y qué robó cada jugador, y cuándo confirmó', () => {
    expect(m.players.b).toMatchObject({ returned: ['b3', 'b4'], doneAt: 2 });
    expect(m.players.b.drawn.map(x => x.id)).toEqual(['b5', 'b6']);
    expect(m.players.a).toMatchObject({ returned: [], drawn: [], doneAt: 3 });
    expect(m.players.a.initial.map(x => x.id)).toEqual(['a1', 'a2', 'a3', 'a4']);
  });
  it('devuelve null si el replay no tiene mulligan', () => {
    expect(computeMulligans([frame('in_game', { a: [] })])).toBeNull();
  });
});

describe('flechas de objetivo', () => {
  const src = 'chain-plr_1-card_2196f1c2-e42d-4575-95dd-0fd8dc1c4b28-7f26ec89-06cf-405d-a082-dbe137f78069';
  it('extrae la carta original del origen en la cadena', () => {
    expect(sourceCardOf(src)).toBe('card_2196f1c2-e42d-4575-95dd-0fd8dc1c4b28');
    expect(sourceCardOf('card_x')).toBe('card_x');
  });
  it('lee las flechas de todos los jugadores e ignora las incompletas', () => {
    const as = targetArrows({ targetArrowsByPlayer: {
      p1: [{ sourceAnchor: 'chain', sourceCardId: src, targetAnchor: 'board', targetCardId: 'card_t' }, { sourceCardId: 'x' }],
      p2: null as any,
    } });
    expect(as).toEqual([{ owner: 'p1', sourceKey: 'card_2196f1c2-e42d-4575-95dd-0fd8dc1c4b28', targetCardId: 'card_t', sourceAnchor: 'chain', targetAnchor: 'board' }]);
    expect(arrowsKey(as)).toBe('card_2196f1c2-e42d-4575-95dd-0fd8dc1c4b28>card_t');
    expect(targetArrows({})).toEqual([]);
  });
});
