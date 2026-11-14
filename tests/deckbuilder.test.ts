import { describe, expect, it } from 'vitest';
import { decodeDeck, encodeDeck, fromText, toText } from '../src/deck/format';
import { type DCard, emptyDeck } from '../src/deck/model';
import { validateDeck } from '../src/deck/rules';
import { atLeastOne, deckStats } from '../src/deck/stats';

// catálogo mínimo de prueba
const C: Record<string, DCard> = {};
const add = (code: string, name: string, type: string, sup: string | null, dom: string[], tags: string[] = [], e: number | null = 2, m: number | null = null) => { C[code] = { code, name, type, sup, dom, tags, e, m, pw: null }; };
add('L1', 'Diana, Scorn of the Moon', 'Legend', 'Champion', ['Mind', 'Chaos'], ['diana'], null);
add('CH', 'Diana, Lunari', 'Unit', 'Champion', ['Chaos'], ['diana'], 4, 4);
add('CJ', 'Jinx, Rebel', 'Unit', 'Champion', ['Chaos'], ['jinx'], 5, 5);
add('SG', 'Diana Signature', 'Spell', 'Signature', ['Mind'], ['diana']);
add('SX', 'Jinx Signature', 'Spell', 'Signature', ['Chaos'], ['jinx']);
add('FU', 'Fury Spell', 'Spell', null, ['Fury']);
add('GR', 'Gear', 'Gear', null, []);
add('RM', 'Mind Rune', 'Rune', 'Basic', ['Mind'], [], null);
add('RC', 'Chaos Rune', 'Rune', 'Basic', ['Chaos'], [], null);
add('RF', 'Fury Rune', 'Rune', 'Basic', ['Fury'], [], null);
for (let k = 1; k <= 14; k++) add('M' + k, 'Carta ' + k, k % 2 ? 'Unit' : 'Spell', null, [k % 3 ? 'Mind' : 'Chaos'], [], k % 8, k % 2 ? 3 : null);
add('B1', 'Campo 1', 'Battlefield', null, []); add('B2', 'Campo 2', 'Battlefield', null, []); add('B3', 'Campo 3', 'Battlefield', null, []);
const get = (c: string) => C[c];

function legal() {
  const d = emptyDeck('x', 'Diana');
  d.legend = 'L1'; d.champion = 'CH';
  for (let k = 1; k <= 13; k++) d.main['M' + k] = 3;   // 39 + campeón = 40
  d.runes = { RM: 6, RC: 6 }; d.battlefields = ['B1', 'B2', 'B3'];
  return d;
}

describe('reglas de construcción', () => {
  it('un mazo correcto no tiene errores', () => {
    expect(validateDeck(legal(), get).filter(i => i.level === 'error')).toEqual([]);
  });

  it('detecta tamaño, copias, firmas, dominios, runas y campos', () => {
    const d = legal();
    d.main.M1 = 4;                       // 4 copias
    delete d.main.M12; delete d.main.M13;   // quedan 37 cartas con el campeón: faltan 3
    d.main.FU = 1;                       // fuera de dominio
    d.main.SX = 1;                       // firma de otro campeón
    d.runes = { RM: 6, RF: 5 };          // 11 runas y una fuera de dominio
    d.battlefields = ['B1', 'B1'];       // 2 campos con nombre repetido
    const msgs = validateDeck(d, get).map(i => i.msg).join('\n');
    expect(msgs).toMatch(/4 copias de Carta 1/);
    expect(msgs).toMatch(/Faltan \d+ cartas? en el mazo principal/);
    expect(msgs).toMatch(/fuera de los dominios/);
    expect(msgs).toMatch(/firma de otro campeón/);
    expect(msgs).toMatch(/Falta 1 runa/);
    expect(msgs).toMatch(/runas fuera de los dominios/);
    expect(msgs).toMatch(/Elige 3 campos/);
    expect(msgs).toMatch(/nombres distintos/);
  });

  it('el campeón debe ser de la leyenda y cuenta para las copias', () => {
    const d = legal(); d.champion = 'CJ';
    expect(validateDeck(d, get).some(i => /no es el campeón/.test(i.msg))).toBe(true);
    const e = legal(); e.main.CH = 3;   // 3 en el mazo + el campeón = 4 copias
    expect(validateDeck(e, get).some(i => /4 copias de Diana, Lunari/.test(i.msg))).toBe(true);
  });

  it('máximo 3 cartas de firma en total', () => {
    const d = legal(); d.main.SG = 3; C.SG2 = { ...C.SG, code: 'SG2', name: 'Otra firma' }; d.main.SG2 = 1;
    expect(validateDeck(d, get).some(i => /4 cartas de firma/.test(i.msg))).toBe(true);
  });
});

describe('formato de RiftAtlas y enlaces', () => {
  const raw = 'Legend:\n1 Diana, Scorn of the Moon [L1]\n\nChampion:\n1 Diana, Lunari [CH]\n\nMainDeck:\n3 Carta 1 [M1]\n2 Gear [GR]\n\nBattlefields:\n1 Campo 1 [B1]\n1 Campo 2 [B2]\n\nRunes:\n6 Mind Rune [RM]\n6 Chaos Rune [RC]\n\nSideboard:\n1 Fury Spell [FU]\n1 Desconocida [ZZZ-999]';
  const resolve = (name: string, code?: string) => (code && C[code] ? code : Object.values(C).find(c => c.name === name)?.code ?? null);

  it('importa todas las secciones y avisa lo que no reconoce', () => {
    const { deck, missing } = fromText(raw, 'i', resolve);
    expect(deck.legend).toBe('L1');
    expect(deck.champion).toBe('CH');
    expect(deck.main).toEqual({ M1: 3, GR: 2 });
    expect(deck.battlefields).toEqual(['B1', 'B2']);
    expect(deck.runes).toEqual({ RM: 6, RC: 6 });
    expect(deck.side).toEqual({ FU: 1 });
    expect(missing).toEqual(['Desconocida [ZZZ-999]']);
  });

  it('exporta en el mismo formato y vuelve a leerse igual', () => {
    const { deck } = fromText(raw, 'i', resolve);
    const again = fromText(toText(deck, get), 'j', resolve).deck;
    expect({ ...again, id: 'i', updatedAt: 0 }).toEqual({ ...deck, updatedAt: 0 });
    expect(toText(deck, get)).toMatch(/^Legend:\n1 Diana, Scorn of the Moon \[L1\]\n\nChampion:/);
  });

  it('el enlace guarda el mazo completo, con el nombre', () => {
    const d = legal(); d.name = 'Diana ñ control'; d.side = { FU: 2 };
    const back = decodeDeck(encodeDeck(d), 'z')!;
    expect({ ...back, id: d.id, updatedAt: d.updatedAt }).toEqual(d);
    expect(encodeDeck(d)).toMatch(/^[\w-]+$/);   // apto para una URL
    expect(decodeDeck('%%%', 'z')).toBeNull();
  });
});

describe('estadísticas', () => {
  it('curva, tipos y dominios incluyen al campeón', () => {
    const s = deckStats(legal(), get);
    expect(s.curve.reduce((a, b) => a + b, 0)).toBe(40);
    expect(s.types.Unit + s.types.Spell).toBe(40);
    expect(s.domains.Chaos).toBeGreaterThan(0);
  });

  it('probabilidad de robar al menos una copia', () => {
    expect(atLeastOne(40, 3, 4)).toBeCloseTo(0.2773, 3);
    expect(atLeastOne(40, 0, 4)).toBe(0);
    expect(atLeastOne(4, 1, 10)).toBe(1);
  });
});
