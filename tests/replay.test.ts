import { describe, expect, it } from 'vitest';
import { REPLAY_FORMAT, decodeReplay, type RawReplay } from '../src/replay/decode';
import { translateLog } from '../src/replay/translate';
import { parseDeck } from '../src/replay/deck';

describe('decodeReplay', () => {
  // grafo mínimo con la misma forma que los replays del simulador: dos jugadas que comparten un estado
  const raw: RawReplay = {
    format: REPLAY_FORMAT,
    version: 2,
    nodes: [
      ['o', [['score', 3]]],                         // 0: tablero compartido
      ['o', [['board', { r: 0 }], ['name', 'Ana']]], // 1: jugador
      ['a', [{ r: 1 }]],                             // 2: lista de jugadores
      ['o', [['players', { r: 2 }], ['turnNumber', 4]]], // 3: estado
      ['o', [['actionType', 'end_turn'], ['state', { r: 3 }]]], // 4: jugada 1
      ['o', [['actionType', 'move_card'], ['state', { r: 3 }]]], // 5: jugada 2 (mismo estado)
      ['a', [{ r: 4 }, { r: 5 }]],                   // 6: jugadas
      ['o', [['frames', { r: 6 }], ['replayId', 'X:1']]], // 7: raíz
    ],
    root: { r: 7 },
  };

  it('resuelve referencias y conserva los objetos compartidos', () => {
    const r = decodeReplay<any>(raw);
    expect(r.replayId).toBe('X:1');
    expect(r.frames).toHaveLength(2);
    expect(r.frames[0].state.players[0]).toEqual({ board: { score: 3 }, name: 'Ana' });
    expect(r.frames[0].state).toBe(r.frames[1].state);
  });

  it('soporta ciclos sin quedarse en un bucle', () => {
    const cyc: RawReplay = { format: REPLAY_FORMAT, nodes: [['o', [['self', { r: 0 }]]]], root: { r: 0 } };
    const o = decodeReplay<any>(cyc);
    expect(o.self).toBe(o);
  });

  it('rechaza archivos que no son replays o con referencias rotas', () => {
    expect(() => decodeReplay({ format: 'otro', nodes: [], root: { r: 0 } })).toThrow('no es un replay');
    expect(() => decodeReplay({ format: REPLAY_FORMAT, nodes: [], root: { r: 5 } })).toThrow('Referencia rota');
  });
});

describe('translateLog', () => {
  it.each([
    ['Vavy played Honest Broker from hand to base.', 'Vavy juega Honest Broker en la base'],
    ['Killjoyz moved Diana, Lunari to Packed Amphitheater.', 'Killjoyz mueve Diana, Lunari a Packed Amphitheater'],
    ['Vavy conquered Trifarian War Camp and scored 1.', 'Vavy conquista Trifarian War Camp y anota 1'],
    ['Vavy scored 1 at turn start. Score: 1 → 2.', 'Vavy anota 1 al inicio del turno (1 → 2)'],
    ['ZERO paid 4E — Exhaust 4.', 'ZERO paga 4E'],
    ['Chain resolved: Patched Porobot.', 'Se resuelve: Patched Porobot'],
  ])('%s', (en, es) => expect(translateLog(en, 'es')).toBe(es));

  it('deja el texto original en inglés o si no lo reconoce', () => {
    expect(translateLog('Vavy ended their turn.', 'en')).toBe('Vavy ended their turn.');
    expect(translateLog('Algo nuevo pasó', 'es')).toBe('Algo nuevo pasó');
  });
});

describe('parseDeck', () => {
  it('agrupa por sección y lee cantidad, nombre y código', () => {
    const d = parseDeck('Legend:\n1 Diana, Scorn of the Moon [UNL-234]\n\nMain Deck:\n3 Stupefy [OGN-095]\n2 Gust\n');
    expect(d.Legend).toEqual([{ n: 1, name: 'Diana, Scorn of the Moon', code: 'UNL-234' }]);
    expect(d.MainDeck).toEqual([{ n: 3, name: 'Stupefy', code: 'OGN-095' }, { n: 2, name: 'Gust', code: undefined }]);
  });
});
