// @vitest-environment jsdom
// En la mesa: escanear (o buscar) la carta del rival y leerla en inglés, sin tocar la colección.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('tesseract.js', () => ({ createWorker: async () => { throw new Error('sin OCR en pruebas'); } }));

const html = readFileSync(resolve(process.cwd(), 'app/index.html'), 'utf8');
const pr = (code: string, cardId: string) =>
  ({ shortCode: code, setId: 's-rad', rarity: 'common', artVariant: 'normal', finish: 'normal', images: [{ imageId: 'img-' + code }], publicCode: `${code}/167-EN`, language: 'EN', cardId });
const catalog = {
  sets: [{ id: 's-rad', slug: 'RAD', name: 'Radiance', setType: 'main', releases: { EN: { releasedAt: '2026-10-23' } } }],
  cards: { c1: { name: 'Amateur Demolitionist', types: ['unit'], superTypes: [] }, c2: { name: 'Brawl', types: ['spell'], superTypes: [] } },
  printings: { a: pr('RAD-001', 'c1'), c: pr('RAD-004', 'c2') },
};
const rc = (id: string, name: string, type: string, text: string, energy: number, might: number | null) => ({
  name, classification: { type, supertype: null, domain: ['Fury'], rarity: 'Common' }, media: { image_url: 'https://x/' + id + '.png' },
  text: { plain: text, rich: text }, attributes: { energy, might, power: null }, metadata: {}, tags: [], collector_number: 1, riftbound_id: id + '-1', set: { set_id: 'RAD' },
});
const items = [rc('rad-001', 'Amateur Demolitionist', 'Unit', 'When you play me, deal 2 to a unit.', 3, 2), rc('rad-004', 'Brawl', 'Spell', 'Two units fight.', 2, null)];

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const errors: unknown[] = [];
const esc = () => dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
const search = (sel: string, q: string) => { const i = $(sel) as HTMLInputElement; i.value = q; i.dispatchEvent(new Event('input', { bubbles: true })); };

beforeAll(async () => {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  (Element.prototype as any).animate = () => ({ finished: Promise.resolve(), cancel() {} });
  (Element.prototype as any).scrollIntoView = () => {};
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    String(url).includes('openrift-catalog') ? { ok: true, json: async () => catalog }
      : String(url).includes('riftcodex') ? { ok: true, json: async () => ({ items, pages: 1 }) } : { ok: false, json: async () => null }));
  addEventListener('error', e => errors.push(e.error));
  addEventListener('unhandledrejection', e => errors.push(e.reason));
  await import('../src/main');
  await new Promise(r => setTimeout(r, 30));
});

describe('en la mesa', () => {
  it('cerrada no tapa la página: su display:flex no le gana a hidden', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/table.css'), 'utf8');
    expect(css).toMatch(/#mesa\[hidden\]\{display:none\}/);
    expect($('#mesa').hidden).toBe(true);
  });
  it('se abre desde el inicio, lista para escanear', () => {
    ($('#hMesa') as HTMLButtonElement).click();
    expect($('#mesa').hidden).toBe(false);
    expect($('#msView .msempty')).not.toBeNull();
    expect($('#msSeen').textContent).toBe('');
  });

  it('buscando el número se ve la carta en grande con su texto en inglés', () => {
    search('#msQ', 'RAD 004');
    ($('#msHits [data-mspick="RAD-004"]') as HTMLButtonElement).click();
    expect($('#msView h2').textContent).toBe('Brawl');
    expect($('#msView .mstext').textContent).toContain('Two units fight.');
    expect($('#msView .msmeta').textContent).toContain('Energía 2');
    expect(document.querySelectorAll('#msSeen .msth')).toHaveLength(1);
  });

  it('el escáner en modo búsqueda entrega la carta y se cierra, sin sumarla a la colección', async () => {
    ($('#msScan') as HTMLButtonElement).click();
    await new Promise(r => setTimeout(r, 10));
    expect($('#coscan').hidden).toBe(false);
    expect($('#coscan').classList.contains('lookup')).toBe(true);
    search('#csQ', 'RAD 001');
    ($('#csHits [data-cspick="RAD-001"]') as HTMLButtonElement).click();
    expect($('#coscan').hidden).toBe(true);
    expect($('#coscan').classList.contains('lookup')).toBe(false);
    expect($('#msView h2').textContent).toBe('Amateur Demolitionist');
    expect($('#msView .msmeta').textContent).toContain('Poder 2');
    // la más nueva va primero
    expect([...document.querySelectorAll('#msSeen .msth')].map(t => (t as HTMLElement).dataset.mscard)).toEqual(['RAD-001', 'RAD-004']);
    expect(JSON.parse(localStorage.getItem('rb_proj_coll:mine') || 'null')?.items?.['RAD-001']).toBeUndefined();
  });

  it('tocar una de la tira la vuelve a mostrar', () => {
    ($('#msSeen [data-mscard="RAD-004"]') as HTMLButtonElement).click();
    expect($('#msView h2').textContent).toBe('Brawl');
    expect($('#msSeen .msth.on')!.getAttribute('data-mscard')).toBe('RAD-004');
  });

  it('Esc con la cámara abierta solo cierra la cámara; la partida se recuerda al volver', async () => {
    ($('#msScan') as HTMLButtonElement).click();
    await new Promise(r => setTimeout(r, 10));
    esc();
    expect($('#coscan').hidden).toBe(true);
    expect($('#mesa').hidden).toBe(false);
    esc();
    expect($('#mesa').hidden).toBe(true);
    ($('#hMesa') as HTMLButtonElement).click();
    expect(document.querySelectorAll('#msSeen .msth')).toHaveLength(2);
  });

  it('partida nueva vacía la tira', () => {
    ($('#msSeen [data-msnew]') as HTMLButtonElement).click();
    expect($('#msSeen').textContent).toBe('');
    expect($('#msView .msempty')).not.toBeNull();
    expect(errors).toEqual([]);
  });
});
