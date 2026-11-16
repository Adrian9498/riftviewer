// Intercambios: lo que sobra, lo que se busca, el enlace y el cruce entre dos listas.
import { describe, expect, it } from 'vitest';
import { decodeTrade, encodeTrade, extras, matchLists, tradeText, wants } from '../src/collection/trade';
import type { Printing } from '../src/collection/model';

const pr = (code: string, name: string, o: Partial<Printing> = {}): Printing => ({
  code, name, set: 'OGN', num: 1, prefix: '', suffix: '', total: 298, rarity: 'Common', variant: 'Normal', finishes: ['normal', 'foil'], type: 'Unit', token: false, img: '', base: true, ...o,
});
const prints = [
  pr('OGN-001', 'Jinx, Rebel'), pr('OGN-001A', 'Jinx, Rebel', { variant: 'Arte alterno' }),
  pr('OGN-002', 'Gust', { type: 'Spell' }),
  pr('OGN-251', 'Jinx - Loose Cannon', { type: 'Legend' }),
  pr('OGN-289', "Targon's Peak", { type: 'Battlefield' }),
  pr('OGN-R01', 'Fury Rune', { type: 'Rune' }),
];
const byCode = new Map(prints.map(p => [p.code, p]));
const key = (p: Printing) => p.name.toLowerCase();

describe('lo que te sobra', () => {
  const col = { id: 'mine', updatedAt: 1, items: {
    'OGN-001': { normal: 4, foil: 1 },   // 5 Jinx en total: te quedas 3
    'OGN-001A': { normal: 1 },
    'OGN-002': { normal: 3 },            // justo 3: nada sobra
    'OGN-251': { normal: 2 },            // leyenda: te quedas 1
    'OGN-289': { normal: 3 },            // campo: te quedas 1
    'OGN-R01': { normal: 20 },           // runas: nunca
  } };
  it('te quedas 3 por carta (1 de leyendas y campos); primero las especiales, y se ofrecen las sencillas', () => {
    expect(extras(col, byCode, key)).toEqual([
      { code: 'OGN-001', finish: 'normal', n: 3 },
      { code: 'OGN-251', finish: 'normal', n: 1 },
      { code: 'OGN-289', finish: 'normal', n: 2 },
    ]);
  });
  it('las que no quieres cambiar no aparecen', () => {
    expect(extras(col, byCode, key, new Set(['jinx, rebel'])).map(x => x.code)).toEqual(['OGN-251', 'OGN-289']);
  });
});

describe('lo que buscas', () => {
  it('lo de tus mazos, más lo agregado a mano (sin bajar lo que el mazo pide), menos lo quitado', () => {
    const w = wants([{ key: 'gust', code: 'OGN-002', n: 2 }, { key: 'jinx', code: 'OGN-001', n: 1 }], { gust: { code: 'OGN-002', n: 1 }, flash: { code: 'OGS-011', n: 1 } }, new Set(['jinx']));
    expect(w).toEqual([{ key: 'gust', code: 'OGN-002', n: 2, manual: true }, { key: 'flash', code: 'OGS-011', n: 1, manual: true }]);
  });
});

describe('enlace y cruce', () => {
  const ana = { name: 'Ana; de la tienda', have: [{ code: 'OGN-001', finish: 'foil', n: 2 }, { code: 'OGN-002', finish: 'normal', n: 1 }], want: [{ code: 'OGN-251', n: 1 }] };
  it('la lista va y vuelve por el enlace', () => {
    const t = decodeTrade(encodeTrade(ana))!;
    expect(t.name).toBe('Ana, de la tienda');
    expect(t.have).toEqual(ana.have);
    expect(t.want).toEqual(ana.want);
    expect(decodeTrade('basura!!')).toBeNull();
  });
  it('qué te puede dar: lo que ofrece y tú buscas, hasta las copias que buscas', () => {
    const k = (c: string) => byCode.get(c)?.name.toLowerCase() || c;
    expect(matchLists(ana.have, [{ code: 'OGN-001A', n: 1 }], k)).toEqual([{ key: 'jinx, rebel', code: 'OGN-001', finish: 'foil', n: 1 }]);
    expect(matchLists(ana.have, [{ code: 'OGN-999', n: 1 }], k)).toEqual([]);
  });
  it('texto para WhatsApp', () => {
    const txt = tradeText(ana, c => byCode.get(c)?.name || c, 'https://x/#trade=abc');
    expect(txt).toContain('Me sobran:\n2 Jinx, Rebel (foil)\n1 Gust');
    expect(txt).toContain('Busco:\n1 Jinx - Loose Cannon');
    expect(txt.endsWith('https://x/#trade=abc')).toBe(true);
  });
});
