import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { artSignature, artSimilarity, findByArt, pickVariant, sigFromB64, sigToB64 } from '../src/collection/artsig';
import { buildPrintings, lookalikes } from '../src/collection/model';

// "carta" sintética: un patrón de colores que depende de la semilla
function card(seed: number, w = 60, h = 84, light = 1, tint = [1, 1, 1]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = (y * w + x) * 4, v = [Math.sin(x / 5 + seed) * 100 + 128, Math.cos(y / 6 + seed * 2) * 100 + 128, Math.sin((x + y) / 7 + seed * 3) * 100 + 128];
    for (let c = 0; c < 3; c++) d[k + c] = v[c] * light * tint[c];
    d[k + 3] = 255;
  }
  return d;
}

describe('huella del arte', () => {
  it('no le afectan la luz ni el tono, y distingue artes distintos', () => {
    const a = artSignature(card(1), 60, 84), dark = artSignature(card(1, 60, 84, 0.6, [1.1, 1, 0.8]), 60, 84), b = artSignature(card(4), 60, 84);
    expect(artSimilarity(a, dark)).toBeGreaterThan(0.95);
    expect(artSimilarity(a, b)).toBeLessThan(0.5);
    expect(artSimilarity(sigFromB64(sigToB64(a)), a)).toBe(1);
  });
  it('elige la versión que se parece, y respeta al OCR cuando el arte no decide', () => {
    const cam = artSignature(card(2, 60, 84, 0.7, [1, 0.9, 1.1]), 60, 84);
    const cands = [{ code: 'X-001', sig: artSignature(card(1), 60, 84) }, { code: 'X-001A', sig: artSignature(card(2), 60, 84) }];
    expect(pickVariant(cam, cands, 'X-001')?.code).toBe('X-001A');
    expect(pickVariant(cam, cands, 'X-001A')?.code).toBe('X-001A');
    // dos versiones con el mismo arte (firmada y normal): se queda con la que leyó el OCR
    const twins = [{ code: 'X-002', sig: cands[1].sig }, { code: 'X-002*', sig: cands[1].sig }];
    expect(pickVariant(cam, twins, 'X-002*')?.code).toBe('X-002*');
    expect(pickVariant(cam, [cands[0]], 'X-001')).toBeNull();   // una sola: nada que elegir
    // el OCR leyó otro número (179 por 175) y las dos versiones de la buena empatan: va la normal, no la firmada
    const read179 = [{ code: 'X-179', sig: cands[0].sig }, { code: 'X-175*', sig: cands[1].sig }, { code: 'X-175', sig: cands[1].sig }];
    expect(pickVariant(cam, read179, 'X-179')?.code).toBe('X-175');
  });
  it('busca en todo el set cuando la leída no se parece, sin elegir la firmada por empate', () => {
    const cam = artSignature(card(2, 60, 84, 0.8), 60, 84);
    const set = [1, 2, 3, 4, 5].map(s => ({ code: `X-00${s}`, group: String(s), sig: artSignature(card(s), 60, 84) }));
    set.push({ code: 'X-002*', group: '2', sig: set[1].sig });
    expect(findByArt(cam, set)?.code).toBe('X-002');
    expect(findByArt(artSignature(card(9), 60, 84), set.slice(0, 1))).toBeNull();   // nada se parece
  });
});

describe('cartas parecidas a la leída', () => {
  const { prints } = buildPrintings(JSON.parse(readFileSync(resolve(process.cwd(), 'public/openrift-catalog.json'), 'utf8')));
  const codes = (c: string) => lookalikes(prints, prints.find(p => p.code === c)!).map(p => p.code);
  it('incluye sus versiones y los números con un 3 confundido', () => {
    const l = codes('RAD-038');
    expect(l).toEqual(expect.arrayContaining(['RAD-038', 'RAD-033', 'RAD-039', 'RAD-088']));
    expect(l.every(c => c.startsWith('RAD-'))).toBe(true);
    expect(codes('UNL-116')).toContain('UNL-116A');
    expect(codes('RAD-179')).toEqual(expect.arrayContaining(['RAD-175', 'RAD-175*']));   // el 5 leído como 9
  });
});
