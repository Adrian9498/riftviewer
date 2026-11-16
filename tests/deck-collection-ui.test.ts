// @vitest-environment jsdom
// Tu colección dentro del constructor: cuántas tienes de cada carta, filtro, y la lista de lo que falta para TCGplayer.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'app/index.html'), 'utf8');
const item = (id: string, name: string, type: string, domain: string[], energy: number | null = 2) => ({
  name, riftbound_id: id, classification: { type, supertype: null, domain, rarity: 'Common' }, attributes: { energy, might: type === 'Unit' ? 3 : null, power: null },
  text: { plain: 'Texto de ' + name, rich: '' }, media: { image_url: `https://img/${id}.png` }, metadata: { alternate_art: false, signature: false, overnumbered: false },
  tags: [], set: { set_id: 'OGN' },
});
const items = [item('ogn-004-1', 'Stupefy', 'Spell', ['Mind'], 1), item('ogn-007-1', 'Flash', 'Spell', ['Mind'], 2)];
// el catálogo de OpenRift (de ahí sale la colección): Stupefy con su arte alterno
const pr = (code: string, cardId: string, artVariant = 'normal') =>
  ({ shortCode: code, setId: 's', rarity: 'common', artVariant, finish: 'normal', images: [{ imageId: 'i-' + code }], publicCode: `${code}/298-EN`, language: 'EN', cardId });
const catalog = {
  sets: [{ id: 's', slug: 'OGN', name: 'Origins', setType: 'main', releases: { EN: { releasedAt: '2025-10-31' } } }],
  cards: { a: { name: 'Stupefy', types: ['spell'], superTypes: [] }, b: { name: 'Flash', types: ['spell'], superTypes: [] } },
  printings: { 1: pr('OGN-004', 'a'), 2: pr('OGN-004a', 'a', 'altart'), 3: pr('OGN-007', 'b') },
};

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const tile = (name: string) => [...document.querySelectorAll('#dbGrid .dbc')].find(t => t.getAttribute('title') === name) as HTMLElement;
let errors: unknown[] = [];

beforeAll(async () => {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  (Element.prototype as any).animate = () => ({ finished: Promise.resolve(), cancel() {} });
  (Element.prototype as any).scrollIntoView = () => {};
  (globalThis as any).CSS = { escape: (s: string) => s };
  localStorage.clear();
  // tienes 1 Stupefy normal y 1 de arte alterno; Flash no
  localStorage.setItem('rb_proj_coll:mine', JSON.stringify({ id: 'mine', items: { 'OGN-004': { normal: 1 }, 'OGN-004A': { foil: 1 } }, ts: 1 }));
  localStorage.setItem('rb_prices1', JSON.stringify({ day: '2026-11-14', t: Date.now(), prices: { 'OGN-004': [0.5, 0.4, 1, 0.9, 1], 'OGN-007': [3, 2.5, 5, 4, 2] } }));
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    String(url).includes('riftcodex') ? { ok: true, json: async () => ({ items, pages: 1 }) }
      : String(url).includes('openrift-catalog') ? { ok: true, json: async () => catalog } : { ok: false, json: async () => null }));
  addEventListener('error', e => errors.push(e.error));
  await import('../src/main');
  await new Promise(r => setTimeout(r, 30));
});

describe('tu colección en el constructor', () => {
  it('cada carta del catálogo dice cuántas tienes, de cualquier versión', () => {
    ($('#hDecks') as HTMLButtonElement).click();
    ($('#dlNew') as HTMLButtonElement).click();
    expect($('#dbOwnW').hidden).toBe(false);
    expect(tile('Stupefy').querySelector('.dbown')!.textContent).toBe('2');
    expect(tile('Flash').querySelector('.dbown')).toBeNull();
  });
  it('"Solo las que tengo" deja solo esas', () => {
    const own = $('#dbOwn') as HTMLInputElement; own.checked = true; own.dispatchEvent(new Event('input', { bubbles: true }));
    expect([...document.querySelectorAll('#dbGrid .dbc')].map(t => t.getAttribute('title'))).toEqual(['Stupefy']);
    own.checked = false; own.dispatchEvent(new Event('input', { bubbles: true }));
  });
  it('la lista del mazo marca lo que falta, y "Ver qué me falta" arma la lista para TCGplayer', () => {
    for (let k = 0; k < 3; k++) tile('Stupefy').click();
    tile('Flash').click(); tile('Flash').click();
    expect($('#dbPanel .dbr[data-code="OGN-004"] .dbhave').textContent).toBe('te faltan 1');
    expect($('#dbPanel .dbcost').textContent).toContain('te faltan 3');
    ($('#dbPanel [data-missing]') as HTMLButtonElement).click();
    expect($('#modal').classList.contains('show')).toBe(true);
    expect(($('#modal textarea') as HTMLTextAreaElement).value).toBe('2 Flash\n1 Stupefy');   // primero la más cara
    expect($('#modal .dbmiss .tot').textContent).toContain('$6.50');
    expect(errors).toEqual([]);
  });
});
