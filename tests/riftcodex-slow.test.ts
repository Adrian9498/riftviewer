// @vitest-environment jsdom
// Mientras riftcodex sigue cargando (puede tardar más de medio minuto), las cartas ya salen de OpenRift:
// un mazo compartido (por ejemplo el de una guía) tiene leyenda y cartas reconocidas desde el principio.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('tesseract.js', () => ({ createWorker: async () => { throw new Error('sin OCR en pruebas'); } }));
const html = readFileSync(resolve(process.cwd(), 'app/index.html'), 'utf8');
const catalog = JSON.parse(readFileSync(resolve(process.cwd(), 'public/openrift-catalog.json'), 'utf8'));
const errors: unknown[] = [];

beforeAll(async () => {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  (Element.prototype as any).animate = () => ({ finished: Promise.resolve(), cancel() {} });
  (Element.prototype as any).scrollIntoView = () => {};
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('riftcodex')) return new Promise(() => {});   // riftcodex nunca contesta (aún)
    return String(url).includes('openrift-catalog') ? { ok: true, json: async () => catalog } : { ok: false, json: async () => null };
  }));
  addEventListener('error', e => errors.push(e.error));
  await import('../src/main');
  await new Promise(r => setTimeout(r, 50));
});

describe('riftcodex lento', () => {
  it('las cartas del mazo de la guía de Diana se reconocen por código antes de que llegue riftcodex', async () => {
    const { deckCard } = await import('../src/app/cards');
    // los códigos que salían "no reconocidos" en el mazo de la guía mientras riftcodex cargaba
    for (const code of ['OGN-103', 'OGN-199', 'SFD-140', 'UNL-150', 'RAD-101', 'UNL-079']) {
      const c = deckCard(code);
      expect(c, code).toBeTruthy();
      expect(c!.type, code).toBeTruthy();
    }
    expect(errors).toEqual([]);
  });

  it('el constructor ya tiene la leyenda de Diana para elegir', async () => {
    const { deckCatalog } = await import('../src/app/cards');
    expect(deckCatalog().some((c: { type: string; name: string }) =>c.type === 'Legend' && /diana/i.test(c.name))).toBe(true);
  });
});
