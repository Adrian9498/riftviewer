// @vitest-environment jsdom
// La página pública de la carpeta: carga por el enlace, resumen, filtros, hojas y la carta en grande.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const cards = Array.from({ length: 23 }, (_, k) => ({
  c: `OGN-${String(k + 1).padStart(3, '0')}`, nm: `Carta ${k + 1}`, i: `img${k}`, s: k < 20 ? 'OGN' : 'SFD', r: 'Common',
  v: k === 4 ? 'Arte alterno' : 'Normal', f: k === 2 ? 'foil' : 'normal', n: k === 0 ? 3 : 1,
}));
vi.mock('../src/cloud/client', () => ({ cloudEnabled: true, supabase: () => null }));
vi.mock('../src/cloud/binder', () => ({
  fetchBinder: async (slug: string) => slug === 'abcdefgh23'
    ? { slug, title: 'Carpeta de Ana', updatedAt: '2026-11-20T10:00:00Z', data: { v: 1, sets: [{ c: 'OGN', n: 'Origins' }, { c: 'SFD', n: 'Spiritforged' }], cards } }
    : null,
}));
vi.mock('../src/cloud/prices', async orig => ({
  ...(await orig() as object),
  latestPrices: async () => ({ day: '2026-11-20', prices: { 'OGN-005': [40, null, null, null, 1], 'OGN-001': [2, null, null, null, 2] } }),
}));

const html = readFileSync(resolve(process.cwd(), 'carpeta/index.html'), 'utf8');
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const names = () => [...document.querySelectorAll('#bvBook .bvpk:not(.empty) img')].map(i => i.getAttribute('alt'));

beforeAll(async () => {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  (globalThis as any).matchMedia = (q: string) => ({ matches: q.includes('min-width: 900px'), addEventListener() {} });
  location.hash = '#abcdefgh23';
  await import('../src/binder/main');
  await new Promise(r => setTimeout(r, 20));
});

describe('carpeta pública (página)', () => {
  it('título, resumen con valor y las joyas', () => {
    expect($('.bvhead h1').textContent).toBe('Carpeta de Ana');
    expect($('#bvStats').textContent).toContain('25 cartas');
    expect($('#bvStats').textContent).toContain('$46.00');
    expect([...document.querySelectorAll('.bvjewel b')].map(b => b.textContent)).toEqual(['Carta 5', 'Carta 1']);
  });
  it('dos hojas de 9 a la vez; se pasa de hoja', () => {
    expect(names()).toHaveLength(18);
    expect($('#bvPos').textContent).toBe('Hojas 1–2 de 3');
    expect($('#bvBook .bvpk.foil em').textContent).toBe('Foil');
    ($('#bvNext') as HTMLButtonElement).click();
    expect(names()).toEqual(['Carta 19', 'Carta 20', 'Carta 21', 'Carta 22', 'Carta 23']);
    expect(($('#bvNext') as HTMLButtonElement).disabled).toBe(true);
  });
  it('filtros por set y solo especiales', () => {
    ($('[data-set="SFD"]') as HTMLButtonElement).click();
    expect(names()).toEqual(['Carta 21', 'Carta 22', 'Carta 23']);
    ($('[data-set=""]') as HTMLButtonElement).click();
    const sp = $('#bvSpecial') as HTMLInputElement; sp.checked = true; sp.dispatchEvent(new Event('change', { bubbles: true }));
    expect(names()).toEqual(['Carta 3', 'Carta 5']);
  });
  it('la carta en grande con copias y precio', () => {
    ($('#bvBook [data-k="1"]') as HTMLButtonElement).click();
    expect($('#bvZoom').hidden).toBe(false);
    expect($('#bvZoom').textContent).toContain('Carta 5');
    expect($('#bvZoom').textContent).toContain('$40.00');
    ($('#bvZoom [data-zx]') as HTMLButtonElement).click();
    expect($('#bvZoom').hidden).toBe(true);
  });
});
