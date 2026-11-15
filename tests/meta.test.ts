import { describe, expect, it } from 'vitest';
import { REPLAY_FORMAT, type RawReplay } from '../src/replay/decode';
import { replayMeta } from '../src/replay/meta';

describe('replayMeta', () => {
  const raw: RawReplay = {
    format: REPLAY_FORMAT,
    nodes: [
      ['o', [['cardCode', 'OGN-247'], ['id', 'card_l1'], ['name', 'Jinx']]],
      ['o', [['legend', { r: 0 }], ['score', 8]]],
      ['o', [['board', { r: 1 }], ['id', 'p1'], ['name', 'Vavy'], ['seat', 1]]],
      ['o', [['board', { score: 6, legend: [{ id: 'card_l2', cardCode: 'SFD-185', name: 'Azir' }] }], ['id', 'p2'], ['name', 'Killjoyz'], ['seat', 0]]],
      ['a', [{ r: 2 }, { r: 3 }]],
      ['o', [['gameOutcome', { winnerPlayerIds: ['p1'] }], ['players', { r: 4 }], ['turnNumber', 14]]],
      ['o', [['state', { r: 5 }]]],
      ['a', [{ r: 6 }]],
      ['o', [['frames', { r: 7 }]]],
    ],
    root: { r: 8 },
  };

  it('ordena por asiento y saca leyenda, marcador y ganador', () => {
    const m = replayMeta(raw)!;
    expect(m.turns).toBe(14);
    expect(m.finished).toBe(true);
    expect(m.players).toEqual([
      { name: 'Killjoyz', score: 6, legendCode: 'SFD-185', legendName: 'Azir', winner: false },
      { name: 'Vavy', score: 8, legendCode: 'OGN-247', legendName: 'Jinx', winner: true },
    ]);
  });

  it('devuelve null si no hay jugadas con jugadores', () => {
    expect(replayMeta({ format: REPLAY_FORMAT, nodes: [['a', []], ['o', [['frames', { r: 0 }]]]], root: { r: 1 } })).toBeNull();
  });
});
