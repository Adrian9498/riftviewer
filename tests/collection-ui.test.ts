// @vitest-environment jsdom
// Pantalla de colección sobre el index.html real, con un catálogo de OpenRift pequeño.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// el OCR real no corre en jsdom: se prueba el escáner con la búsqueda manual
vi.mock('tesseract.js', () => ({ createWorker: async () => { throw new Error('sin OCR en pruebas'); } }));

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const pr = (code: string, cardId: string, finish = 'normal', artVariant = 'normal') =>
  ({ shortCode: code, setId: 's-rad', rarity: 'common', artVariant, finish, images: [{ imageId: 'img-' + code }], publicCode: `${code}/167-EN`, language: 'EN', cardId });
const catalog = {
  sets: [{ id: 's-rad', slug: 'RAD', name: 'Radiance', setType: 'main', releases: { EN: { releasedAt: '2026-10-23' } } }],
  cards: { c1: { name: 'Amateur Demolitionist', types: ['unit'], superTypes: [] }, c2: { name: 'Brawl', types: ['spell'], superTypes: [] } },
  printings: { a: pr('RAD-001', 'c1'), b: pr('RAD-001', 'c1', 'foil'), c: pr('RAD-004', 'c2'), d: pr('RAD-004a', 'c2', 'foil', 'altart') },
};

let errors: unknown[] = [];
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const tile = (code: string) => $(`#coGrid [data-code="${code}"]`);

beforeAll(async () => {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  (Element.prototype as any).animate = () => ({ finished: Promise.resolve(), cancel() {} });
  (Element.prototype as any).scrollIntoView = () => {};
  (globalThis as any).CSS = { escape: (s: string) => s };
  localStorage.clear();
  // precios de un día (como los deja la caché del navegador): RAD-001 normal $0.25 / foil $1.50
  localStorage.setItem('rb_prices1', JSON.stringify({ day: '2026-11-14', t: Date.now(), prices: { 'RAD-001': [0.25, 0.1, 1.5, 1.2, 10], 'RAD-004A': [null, null, 3, 2.5, 11] } }));
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    String(url).includes('openrift-catalog') ? { ok: true, json: async () => catalog }
      : String(url).includes('riftcodex') ? { ok: true, json: async () => ({ items: [], pages: 1 }) } : { ok: false, json: async () => null }));
  addEventListener('error', e => errors.push(e.error));
  await import('../src/main');
  await new Promise(r => setTimeout(r, 30));
});

describe('mi colección', () => {
  it('abre desde el inicio con el set más nuevo y su progreso en cero', () => {
    ($('#hColl') as HTMLButtonElement).click();
    expect($('#collb').hidden).toBe(false);
    expect($('#coSets .coset.on')?.dataset.set).toBe('RAD');
    expect(document.querySelectorAll('#coGrid .coc').length).toBe(3);        // todas las versiones, con el arte alterno
    expect(tile('RAD-004A')).not.toBeNull();
    expect(tile('RAD-001').classList.contains('miss')).toBe(true);
    expect($('#coHead').textContent).toContain('Ver las 2 que me faltan');
  });

  it('el + suma una copia y actualiza el progreso; el clic derecho la quita', () => {
    (tile('RAD-001').querySelector('[data-co="+"]') as HTMLButtonElement).click();
    (tile('RAD-001').querySelector('[data-co="+"]') as HTMLButtonElement).click();
    expect(tile('RAD-001').querySelector('.dbn')!.textContent).toBe('2');
    expect($('#coSets .coset.on').textContent).toContain('1/2');
    expect($('#coSets .coset.on').textContent).toContain('50%');
    tile('RAD-001').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    expect(tile('RAD-001').querySelector('.dbn')!.textContent).toBe('1');
  });

  it('el detalle suma foil y muestra las otras versiones', () => {
    (tile('RAD-004').querySelector('img') as HTMLElement).click();
    expect($('#modal').classList.contains('show')).toBe(true);
    expect(document.querySelectorAll('#modal .covar').length).toBe(2);
    ($('#modal .covar[data-dv="RAD-004A"]') as HTMLElement).click();
    ($('#modal [data-df="foil"][data-d="1"]') as HTMLButtonElement).click();
    expect($('#modal .cofin b').textContent).toBe('1');
    ($('#modal .mfoot .btn') as HTMLButtonElement).click();
  });

  it('filtros: me faltan y todas las versiones', () => {
    ($('#coOwn [data-own="miss"]') as HTMLButtonElement).click();
    expect([...document.querySelectorAll('#coGrid .coc')].map(t => (t as HTMLElement).dataset.code)).toEqual(['RAD-004']);
    const v = $('#coVar') as HTMLSelectElement; v.value = 'all'; v.dispatchEvent(new Event('input', { bubbles: true }));
    expect([...document.querySelectorAll('#coGrid .coc')].map(t => (t as HTMLElement).dataset.code)).toEqual(['RAD-004']);
    ($('#coOwn [data-own="have"]') as HTMLButtonElement).click();
    expect(document.querySelectorAll('#coGrid .coc').length).toBe(2);
    expect(tile('RAD-004A').querySelector('.cofoil')).not.toBeNull();
  });

  it('escáner: sin cámara avisa, y la búsqueda manual suma la carta', async () => {
    ($('#coScan') as HTMLButtonElement).click();
    await new Promise(r => setTimeout(r, 20));
    expect($('#coscan').hidden).toBe(false);
    expect($('#csMsg').textContent).toMatch(/cámara|lector/);
    const q = $('#csQ') as HTMLInputElement; q.value = 'rad 4'; q.dispatchEvent(new Event('input'));
    expect(document.querySelectorAll('#csHits [data-cspick]').length).toBe(2);   // RAD-004 y su arte alterno
    ($('#csHits [data-cspick="RAD-004"]') as HTMLButtonElement).click();
    ($('#csRes [data-csadd="normal"]') as HTMLButtonElement).click();
    expect($('#csSess').textContent).toContain('1 carta');
    ($('[data-csundo]') as HTMLButtonElement).click();
    expect($('#csSess').textContent).toBe('');
    ($('#csClose') as HTMLButtonElement).click();
    expect($('#coscan').hidden).toBe(true);
  });

  it('precios: en la carta, valor de la colección y orden por las más valiosas', async () => {
    await new Promise(r => setTimeout(r, 10));
    expect(tile('RAD-001').querySelector('.copr')!.textContent).toBe('$0.25');
    expect($('#coTot').textContent).toContain('vale $3.25');            // 1 normal ($0.25) + 1 foil del arte alterno ($3)
    const s = $('#coSort') as HTMLSelectElement; s.value = 'price'; s.dispatchEvent(new Event('input', { bubbles: true }));
    expect((document.querySelector('#coGrid .coc') as HTMLElement).dataset.code).toBe('RAD-004A');
  });

  it('"vale $X" abre el valor de tu colección con lo que más vale', async () => {
    ($('#coTot [data-value]') as HTMLButtonElement).click();
    expect($('#modal').classList.contains('show')).toBe(true);
    const rows = [...document.querySelectorAll('#modal .covrow')].map(r => (r as HTMLElement).dataset.vcard);
    expect(rows).toEqual(['RAD-004A', 'RAD-001']);                        // $3 foil antes que $0.25 normal
    await new Promise(r => setTimeout(r, 10));
    expect($('#modal .covalue').textContent).toMatch(/No se pudo cargar|Cargando/);   // en pruebas no hay nube
    ($('#modal .mfoot .btn') as HTMLButtonElement).click();
  });

  it('se guarda como proyecto para sincronizarse', async () => {
    await new Promise(r => setTimeout(r, 450));
    const saved = JSON.parse(localStorage.getItem('rb_proj_coll:mine')!);
    expect(saved.items).toEqual({ 'RAD-001': { normal: 1 }, 'RAD-004A': { foil: 1 } });
    ($('#coBack') as HTMLButtonElement).click();
    expect($('#collb').hidden).toBe(true);
    expect(errors).toEqual([]);
  });
});
