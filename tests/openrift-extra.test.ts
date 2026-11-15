// Cartas que solo están en OpenRift (sets nuevos como Radiance) entran al catálogo con la forma de riftcodex.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openRiftExtraCards } from '../src/data/openrift';
import { norm } from '../src/data/text';

const cat = JSON.parse(readFileSync(resolve(process.cwd(), 'public/openrift-catalog.json'), 'utf8'));

describe('cartas extra de OpenRift', () => {
  const extra = openRiftExtraCards(cat, norm, new Set());
  const rad = extra.filter(c => c.set === 'RAD');

  it('trae Radiance con tipo, dominios y costo', () => {
    expect(rad.length).toBeGreaterThan(150);
    const c = rad.find(x => x.code === 'RAD-001')!;
    expect(c).toMatchObject({ name: 'Amateur Demolitionist', type: 'Unit', dom: ['Fury'], e: 2, m: 1, alt: false });
  });

  it('leyendas con el nombre del campeón, firmas y runas reconocidas', () => {
    expect(rad.find(x => x.code === 'RAD-139')).toMatchObject({ type: 'Legend', name: 'Ekko - Boy Who Shattered Time', tags: ['ekko'] });
    expect(rad.find(x => x.code === 'RAD-140')?.sup).toBe('Signature');
    expect(rad.find(x => x.code === 'RAD-R01')).toMatchObject({ type: 'Rune', sup: 'Basic' });
    expect(rad.some(x => x.code.startsWith('RAD-T'))).toBe(false);   // las fichas no van al catálogo
  });

  it('no repite los códigos que ya trae riftcodex', () => {
    expect(openRiftExtraCards(cat, norm, new Set(['RAD-001'])).some(c => c.code === 'RAD-001')).toBe(false);
  });
});
