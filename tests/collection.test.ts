// Colección: impresiones del catálogo de OpenRift, conteo por acabado, progreso por set y lectura del número de la carta.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPrintings, bump, collectionText, countOf, emptyCollection, ScanGate, parseCollector, parseCollectorText, searchPrintings, setProgress, variantsOf } from '../src/collection/model';
import { norm } from '../src/data/text';

const cat = JSON.parse(readFileSync(resolve(process.cwd(), 'public/openrift-catalog.json'), 'utf8'));
const { prints, sets } = buildPrintings(cat);
const P = (code: string) => prints.find(p => p.code === code)!;

describe('impresiones', () => {
  it('una por código, con sus acabados y si cuenta para el set base', () => {
    expect(P('RAD-001')).toMatchObject({ name: 'Amateur Demolitionist', set: 'RAD', num: 1, total: 167, base: true, finishes: ['normal', 'foil'] });
    expect(P('OGN-007A')).toMatchObject({ suffix: 'A', variant: 'Arte alterno', base: false });
    expect(P('RAD-R01')).toMatchObject({ prefix: 'R', type: 'Rune', base: false });
    expect(prints.filter(p => p.code === 'RAD-001').length).toBe(1);
  });
  it('sets ordenados del más nuevo al más viejo', () => {
    expect(sets.map(s => s.code)).toContain('RAD');
    expect(sets.findIndex(s => s.code === 'RAD')).toBeLessThan(sets.findIndex(s => s.code === 'OGN'));
  });
});

describe('colección', () => {
  it('suma y resta por acabado sin bajar de cero', () => {
    const c = emptyCollection();
    bump(c, 'RAD-001', 'normal', 2); bump(c, 'rad-001', 'foil', 1);
    expect(countOf(c, 'RAD-001')).toBe(3);
    expect(countOf(c, 'RAD-001', 'foil')).toBe(1);
    bump(c, 'RAD-001', 'foil', -5);
    expect(c.items['RAD-001']).toEqual({ normal: 2 });
    bump(c, 'RAD-001', 'normal', -2);
    expect(c.items['RAD-001']).toBeUndefined();
  });
  it('progreso del set base y de todas las versiones', () => {
    const c = emptyCollection();
    bump(c, 'RAD-001', 'normal', 3); bump(c, 'RAD-002', 'foil', 1); bump(c, 'RAD-R01', 'normal', 6);
    const pr = setProgress(prints, c, 'RAD');
    expect(pr.base).toEqual({ have: 2, total: prints.filter(p => p.set === 'RAD' && p.base).length });
    expect(pr.all.have).toBe(3);
    expect(pr.copies).toBe(10);
    expect(collectionText(prints, c)).toContain('3 Amateur Demolitionist [RAD-001]');
    expect(collectionText(prints, c)).toContain('(Foil)');
  });
});

describe('lectura del número', () => {
  it('lee set, número y total', () => {
    expect(parseCollectorText('RAD • 001/167 EN', prints)[0].code).toBe('RAD-001');
    expect(parseCollectorText('OGN · 007a/298', prints)[0].code).toBe('OGN-007A');
  });
  it('si el set no se lee, lo deduce del total, y corrige O por 0', () => {
    expect(parseCollectorText('~~ O15/167 artist', prints)[0].code).toBe('RAD-015');
    expect(parseCollectorText('nada que ver', prints)).toEqual([]);
  });
  it('versiones especiales, con lo que de verdad lee el OCR de cartas reales', () => {
    const code = (t: string) => parseCollector(t, prints).hits[0]?.code;
    expect(code('UNL  116a/219')).toBe('UNL-116A');        // arte alterno
    expect(code('UNL - 1162/219')).toBe('UNL-116A');       // la "a" leída como 2
    expect(code('UNL - 02927219')).toBe('UNL-029A');       // y además la "/" leída como 7
    expect(code('UNL 228/219')).toBe('UNL-228');           // sobrenumerada (número mayor que el total)
    expect(code('UNL  229*/219')).toBe('UNL-229*');        // firmada
    expect(code('UNL * 2294/219')).toBe('UNL-229*');       // el * leído como 4
    expect(code('VEN - SP4/006 * EN')).toBe('VEN-SP4');    // especiales: SP sin ceros
    expect(code('YEN - 5P27006 - EN')).toBe('VEN-SP2');    // "5P" por "SP" y la "/" como 7; el total dice el set
  });
  it('Radiance: el punto leído como *, y runas sin total', () => {
    const read = (t: string) => parseCollector(t, prints);
    expect(read('RAD * 020a/167 EN').sure).toBe(true);
    expect(read('RAD * 020a/167 EN').hits[0].code).toBe('RAD-020A');
    expect(read('RAD * 0203/167 * EN').hits[0].code).toBe('RAD-020A');   // la "a" leída como 3
    expect(read('RAD ROL - EN')).toMatchObject({ sure: false, hits: [expect.objectContaining({ code: 'RAD-R01' })] });
    expect(read('RAD - ROla - EN A').hits[0].code).toBe('RAD-R01A');
    expect(read('ROL EN').hits).toEqual([]);                             // sin set leído no se adivina la runa
  });
  it('RAD-175: la "/1" leída como 7, y su versión Metal Deluxe (viene sin imagen)', () => {
    expect(parseCollector('RAD 175767 EN', prints).hits[0].code).toBe('RAD-175');
    expect(parseCollector('RAD 175767 EN', prints).sure).toBe(false);
    const p = prints.find(x => x.code === 'RAD-175')!;
    expect(p.finishes).toEqual(expect.arrayContaining(['foil', 'metal-deluxe']));
    expect(p.img).toMatch(/^https:/);
  });
  it('lectura segura (set y total coinciden) contra deducida del total', () => {
    expect(parseCollector('RAD 001/167', prints).sure).toBe(true);
    expect(parseCollector('001/167', prints).sure).toBe(false);
    expect(parseCollector('OGN 001/167', prints).sure).toBe(false);   // el set leído no tiene ese total
    // lecturas reales del OCR con poca resolución: el set se lee bien aunque el total salga con un dígito mal
    expect(parseCollector('a UNL 123/215', prints)).toMatchObject({ sure: false, hits: [expect.objectContaining({ code: 'UNL-123' })] });
    expect(parseCollector('UNL - 103/219', prints).hits[0].code).toBe('UNL-103');
  });
  it('versiones del mismo número y búsqueda manual', () => {
    expect(variantsOf(prints, P('OGN-007')).map(p => p.code)).toEqual(expect.arrayContaining(['OGN-007', 'OGN-007A']));
    expect(searchPrintings('rad 1', prints, norm)[0].code).toBe('RAD-001');
    expect(searchPrintings('amateur demol', prints, norm)[0].code).toBe('RAD-001');
  });
});

describe('escáner: cuándo sumar', () => {
  // simula lecturas cada 100 ms: código leído (o null si no leyó nada) y si fue una lectura segura
  const run = (g: ScanGate, reads: [string | null, boolean?][], auto = true, t0 = 0) =>
    reads.map(([c, sure = true], i) => g.feed(c, sure, t0 + i * 100, auto)).filter(Boolean);

  it('la misma carta no se suma dos veces aunque el lector falle unas lecturas', () => {
    const g = new ScanGate();
    expect(run(g, [['UNL-123'], ['UNL-123'], [null], [null], [null], [null], [null], ['UNL-123'], ['UNL-123'], [null], ['UNL-123']])).toEqual(['UNL-123']);
  });
  it('una mala lectura suelta (un dígito cambiado) no suma otra carta', () => {
    const g = new ScanGate();
    expect(run(g, [['UNL-123'], ['UNL-123'], ['UNL-128'], ['UNL-123'], ['UNL-128'], ['UNL-123']])).toEqual(['UNL-123']);
  });
  it('después de sacar la carta, la misma se puede volver a sumar (otra copia)', () => {
    const g = new ScanGate();
    expect(run(g, [['UNL-123'], ['UNL-123']])).toEqual(['UNL-123']);
    // 2 s sin leer nada: la carta se sacó del marco
    expect(g.feed(null, false, 2300, true)).toBeNull();
    expect(run(g, [['UNL-123'], ['UNL-123']], true, 2400)).toEqual(['UNL-123']);
  });
  it('cambiar de carta rápido suma la nueva', () => {
    const g = new ScanGate();
    expect(run(g, [['UNL-123'], ['UNL-123'], [null], [null], ['UNL-103'], ['UNL-103'], ['UNL-103'], ['UNL-103'], ['UNL-103'], ['UNL-103'], ['UNL-103']])).toEqual(['UNL-123', 'UNL-103']);
  });
  it('sin agregado automático, una lectura segura se muestra a la primera', () => {
    expect(run(new ScanGate(), [['UNL-123']], false)).toEqual(['UNL-123']);
  });
});
