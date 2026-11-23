// Carpeta pública: qué cartas entran, en qué orden, las hojas de 9 y el resumen.
import { describe, expect, it } from 'vitest';
import { binderPages, binderSummary, buildBinder, isSpecial, newSlug, parseBinder } from '../src/collection/binder';
import type { CardSet, Printing } from '../src/collection/model';

const pr = (code: string, name: string, o: Partial<Printing> = {}): Printing => {
  const [set, n] = code.split('-');
  return { code, name, set, num: parseInt(n), prefix: '', suffix: /[A-Z*]$/.test(n) ? n.slice(-1) : '', total: 298, rarity: 'Common', variant: 'Normal', finishes: ['normal', 'foil'], type: 'Unit', token: false,
    img: `https://openrift.app/media/cards/img-${code}-400w.webp`, base: true, ...o };
};
const prints = [
  pr('SFD-010', 'Ahri'), pr('OGN-002', 'Gust', { rarity: 'Epic' }), pr('OGN-001', 'Jinx'), pr('OGN-001A', 'Jinx', { variant: 'Arte alterno' }),
  pr('OGN-R01', 'Fury Rune', { type: 'Rune' }), pr('OGN-T01', 'Sprite', { token: true }),
];
const byCode = new Map(prints.map(p => [p.code, p]));
const sets: CardSet[] = [{ code: 'SFD', name: 'Spiritforged', date: '2026-02-13', main: true }, { code: 'OGN', name: 'Origins', date: '2025-10-31', main: true }];
const col = { id: 'mine', updatedAt: 1, items: {
  'SFD-010': { normal: 1 }, 'OGN-001A': { normal: 1 }, 'OGN-001': { foil: 1, normal: 2 }, 'OGN-002': { normal: 3 }, 'OGN-R01': { normal: 12 }, 'OGN-T01': { normal: 2 },
} };

describe('carpeta pública', () => {
  it('en orden de carpeta: por set (más viejo primero) y número; sin runas ni fichas', () => {
    const b = buildBinder(col, byCode, sets);
    expect(b.cards.map(c => `${c.c}.${c.f}×${c.n}`)).toEqual(['OGN-001.normal×2', 'OGN-001.foil×1', 'OGN-001A.normal×1', 'OGN-002.normal×3', 'SFD-010.normal×1']);
    expect(b.sets.map(s => s.c)).toEqual(['OGN', 'SFD']);
    expect(b.cards[0].i).toBe('img-OGN-001');
  });
  it('solo especiales: alternas, foil y épicas', () => {
    const b = buildBinder(col, byCode, sets, 'special');
    expect(b.cards.map(c => `${c.c}.${c.f}`)).toEqual(['OGN-001.foil', 'OGN-001A.normal', 'OGN-002.normal']);
    expect(b.cards.every(isSpecial)).toBe(true);
  });
  it('hojas de 9 y resumen con las más valiosas', () => {
    expect(binderPages(Array.from({ length: 20 }, (_, k) => k)).map(p => p.length)).toEqual([9, 9, 2]);
    expect(binderPages([])).toEqual([[]]);
    const b = buildBinder(col, byCode, sets);
    const prices: Record<string, number> = { 'OGN-001A': 30, 'OGN-002': 2 };
    const s = binderSummary(b.cards, (c, f) => prices[c] ?? (f === 'foil' ? 5 : null), 2);
    expect(s.copies).toBe(8);
    expect(s.value).toBe(30 + 6 + 5);
    expect(s.best.map(x => x.card.c)).toEqual(['OGN-001A', 'OGN-001']);
  });
  it('lo que llega de la red se revisa', () => {
    expect(parseBinder(null)).toBeNull();
    expect(parseBinder({ v: 1, sets: [], cards: [{ c: 'OGN-001', nm: 'Jinx', i: 'a"><script>', n: 2.7 }, { c: 5 }] })!.cards).toEqual([
      { c: 'OGN-001', nm: 'Jinx', i: 'ascript', s: '', r: '', v: 'Normal', f: 'normal', n: 2 }]);
    expect(newSlug()).toMatch(/^[a-z0-9]{10}$/);
  });
});
