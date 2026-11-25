// @vitest-environment jsdom
// El inicio como centro: tarjetas de cada función, resumen de mazos y colección, y atajos para seguir.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('tesseract.js', () => ({ createWorker: async () => { throw new Error('sin OCR en pruebas'); } }));
const html = readFileSync(resolve(process.cwd(), 'app/index.html'), 'utf8');
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const errors: unknown[] = [];

beforeAll(async () => {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  (Element.prototype as any).animate = () => ({ finished: Promise.resolve(), cancel() {} });
  (Element.prototype as any).scrollIntoView = () => {};
  localStorage.clear();
  localStorage.setItem('rb_proj_deck:d1', JSON.stringify({ id: 'd1', name: 'Diana control', legend: null, champion: null, main: {}, runes: {}, battlefields: [], side: {}, updatedAt: 5,
    record: { w: 2, l: 1 }, games: [{ id: 'g', ts: 1, result: 'w', opp: null }] }));
  localStorage.setItem('rb_proj_deck:d2', JSON.stringify({ id: 'd2', name: 'Jinx', legend: null, champion: null, main: {}, runes: {}, battlefields: [], side: {}, updatedAt: 1 }));
  localStorage.setItem('rb_proj_coll:mine', JSON.stringify({ id: 'mine', items: { 'OGN-001': { normal: 3, foil: 1 }, 'OGN-002': { normal: 2 } }, updatedAt: 1 }));
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    String(url).includes('riftcodex') ? { ok: true, json: async () => ({ items: [], pages: 1 }) } : { ok: false, json: async () => null }));
  addEventListener('error', e => errors.push(e.error));
  await import('../src/main');
  await new Promise(r => setTimeout(r, 30));
});

describe('inicio', () => {
  it('muestra las secciones con todas las funciones', () => {
    const secs = [...document.querySelectorAll('#home .hsech span')].map(s => s.textContent);
    expect(secs).toEqual(['Juega', 'Aprende', 'Colecciona', 'Crea videos']);
    for (const id of ['hDecks', 'hMesa', 'hColl', 'hTrade', 'hNew', 'replayIn', 'hDemo', 'hGuides']) expect($('#' + id)).not.toBeNull();
    expect($('#hGuides').getAttribute('href')).toBe('../guides/');
  });

  it('el resumen: seguir con el último mazo, récord de todos y cartas de la colección', () => {
    const chips = [...document.querySelectorAll('#hStats .hchip')].map(c => c.textContent);
    expect($('#hStats').hidden).toBe(false);
    expect(chips[0]).toContain('Diana control');
    expect(chips[1]).toContain('2 mazos');
    expect(chips[1]).toContain('Récord 3-1');
    expect(chips[2]).toContain('6 cartas');
  });

  it('el atajo abre la página del mazo', () => {
    ($('#hStats [data-hgo="deck"]') as HTMLButtonElement).click();
    expect($('#deckb').hidden).toBe(false);
    expect($('#deckb').dataset.view).toBe('detail');
    expect($('#deckb').textContent).toContain('Diana control');
  });

  it('intercambios se abre desde el inicio', () => {
    ($('#hTrade') as HTMLButtonElement).click();
    expect($('#trade').hidden).toBe(false);
    expect(errors).toEqual([]);
  });
});
