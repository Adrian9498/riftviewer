// @vitest-environment jsdom
// Pantalla de intercambios sobre el index.html real: lo que sobra, lo que busco, compartir y cruzar con la lista de otro.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { decodeTrade, encodeTrade } from '../src/collection/trade';

vi.mock('tesseract.js', () => ({ createWorker: async () => { throw new Error('sin OCR en pruebas'); } }));

const html = readFileSync(resolve(process.cwd(), 'app/index.html'), 'utf8');
const pr = (code: string, cardId: string, finish = 'normal') =>
  ({ shortCode: code, setId: 's-rad', rarity: 'common', artVariant: 'normal', finish, images: [{ imageId: 'img-' + code }], publicCode: `${code}/167-EN`, language: 'EN', cardId });
const catalog = {
  sets: [{ id: 's-rad', slug: 'RAD', name: 'Radiance', setType: 'main', releases: { EN: { releasedAt: '2026-10-23' } } }],
  cards: { c1: { name: 'Amateur Demolitionist', types: ['unit'], superTypes: [] }, c2: { name: 'Brawl', types: ['spell'], superTypes: [] }, c3: { name: 'Fury Rune', types: ['rune'], superTypes: [] }, c4: { name: 'Gust', types: ['spell'], superTypes: [] } },
  printings: { a: pr('RAD-001', 'c1'), b: pr('RAD-001', 'c1', 'foil'), c: pr('RAD-004', 'c2'), r: pr('RAD-R01', 'c3'), g: pr('RAD-010', 'c4') },
};

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const errors: unknown[] = [];
let copied = '';
const tiles = () => [...document.querySelectorAll('#trBody .trc')].map(t => [t.querySelector('.trn')!.textContent, t.querySelector('b')!.textContent]);
const type = (sel: string, v: string) => { const i = $(sel) as HTMLInputElement; i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); };

beforeAll(async () => {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  (Element.prototype as any).animate = () => ({ finished: Promise.resolve(), cancel() {} });
  (Element.prototype as any).scrollIntoView = () => {};
  (globalThis as any).CSS = { escape: (s: string) => s };
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => { copied = t; } }, configurable: true });
  localStorage.clear();
  // 5 Amateur Demolitionist (4 normales y 1 foil), 1 Brawl, 30 runas
  localStorage.setItem('rb_proj_coll:mine', JSON.stringify({ id: 'mine', items: { 'RAD-001': { normal: 4, foil: 1 }, 'RAD-004': { normal: 1 }, 'RAD-R01': { normal: 30 } }, updatedAt: 1 }));
  // un mazo que pide 3 Brawl
  localStorage.setItem('rb_proj_deck:d1', JSON.stringify({ id: 'd1', name: 'Mazo', legend: null, champion: null, main: { 'RAD-004': 3 }, runes: { 'RAD-R01': 12 }, battlefields: [], side: {}, updatedAt: 1 }));
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    String(url).includes('openrift-catalog') ? { ok: true, json: async () => catalog }
      : String(url).includes('riftcodex') ? { ok: true, json: async () => ({ items: [], pages: 1 }) } : { ok: false, json: async () => null }));
  addEventListener('error', e => errors.push(e.error));
  addEventListener('unhandledrejection', e => errors.push(e.reason));
  await import('../src/main');
  await new Promise(r => setTimeout(r, 30));
});

describe('intercambios', () => {
  it('se abre desde la colección: te sobran 2 (te quedas la foil y 2 normales); las runas nunca', () => {
    ($('#coTrade') as HTMLButtonElement).click();
    expect($('#trade').hidden).toBe(false);
    expect(tiles()).toEqual([['Amateur Demolitionist', '×2']]);
    expect($('#trNHave').textContent).toBe('2');
  });

  it('tocar una carta la deja fuera; se puede regresar', () => {
    ($('#trBody [data-trexh]') as HTMLButtonElement).click();
    expect(tiles()).toEqual([]);
    expect($('#trBody .trchips').textContent).toContain('Amateur Demolitionist');
    ($('#trBody [data-trinh]') as HTMLButtonElement).click();
    expect(tiles()).toHaveLength(1);
  });

  it('busco: lo que falta para tus mazos y lo que agregues a mano', () => {
    ($('#trade [data-trtab="want"]') as HTMLButtonElement).click();
    expect(tiles()).toEqual([['Brawl', '×2']]);
    type('#trQ', 'Gust');
    ($('#trHits [data-trpick="RAD-010"]') as HTMLButtonElement).click();
    expect(tiles()).toContainEqual(['Gust', '×1']);
    expect($('#trBody').textContent).toContain('agregada');
  });

  it('compartir: el enlace lleva las dos listas y tu nombre; el texto sirve para WhatsApp', async () => {
    ($('#trShareBtn') as HTMLButtonElement).click();
    ($('#trName') as HTMLInputElement).value = 'Adrián';
    ($('#trSheet [data-trcopylink]') as HTMLButtonElement).click();
    await new Promise(r => setTimeout(r, 0));
    const t = decodeTrade(copied.split('#trade=')[1])!;
    expect(t.name).toBe('Adrián');
    expect(t.have).toEqual([{ code: 'RAD-001', finish: 'normal', n: 2 }]);
    expect(t.want).toEqual(expect.arrayContaining([{ code: 'RAD-004', n: 2 }, { code: 'RAD-010', n: 1 }]));
    ($('#trSheet [data-trcopytext]') as HTMLButtonElement).click();
    await new Promise(r => setTimeout(r, 0));
    expect(copied).toContain('Me sobran:\n2 Amateur Demolitionist');
    expect(copied).toContain('Busco:');
    ($('#trSheet [data-trsclose]') as HTMLButtonElement).click();
    expect($('#trSheet').hidden).toBe(true);
  });

  it('al pegar el enlace de otra persona se ve qué se pueden cambiar', () => {
    const beto = encodeTrade({ name: 'Beto', have: [{ code: 'RAD-004', finish: 'foil', n: 3 }], want: [{ code: 'RAD-001', n: 1 }, { code: 'RAD-010', n: 2 }] });
    ($('#trade [data-trtab="peers"]') as HTMLButtonElement).click();
    type('#trLink', `https://riftviewer.com/app/#trade=${beto}`);
    expect($('#trBody .trpeerh').textContent).toBe('Con Beto');
    const secs = [...document.querySelectorAll('#trBody .trsec')];
    // Beto te da 2 Brawl (buscas 2 aunque ofrece 3); tú le das 1 Amateur Demolitionist
    expect(secs[0].textContent).toContain('Beto te puede dar');
    expect([...secs[0].querySelectorAll('.trc')].map(t => t.querySelector('b')!.textContent)).toEqual(['×2']);
    expect(secs[1].textContent).toContain('Amateur Demolitionist');
    // queda guardada para volver a verla
    ($('#trBody [data-trback]') as HTMLButtonElement).click();
    expect($('#trBody .trpeerb').textContent).toContain('Beto');
    expect(errors).toEqual([]);
  });
});
