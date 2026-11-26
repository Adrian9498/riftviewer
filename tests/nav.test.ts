// @vitest-environment jsdom
// Navegación: el menú "◆ Riftviewer ▾" y las direcciones de cada sección (#/mazos, #/coleccion…).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('tesseract.js', () => ({ createWorker: async () => { throw new Error('sin OCR en pruebas'); } }));
const html = readFileSync(resolve(process.cwd(), 'app/index.html'), 'utf8');
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const tick = () => new Promise(r => setTimeout(r, 0));
let errors: unknown[] = [];

beforeAll(async () => {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  (Element.prototype as any).animate = () => ({ finished: Promise.resolve(), cancel() {} });
  (Element.prototype as any).scrollIntoView = () => {};
  (globalThis as any).CSS = { escape: (s: string) => s };
  localStorage.clear();
  // se abre directo en la colección, como al recargar en #/coleccion
  history.replaceState(null, '', location.pathname + '#/coleccion');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => null })));
  addEventListener('error', e => errors.push(e.error));
  await import('../src/main');
  await new Promise(r => setTimeout(r, 30));
});

describe('navegación', () => {
  it('al cargar abre la sección de la dirección', () => {
    expect($('#collb').hidden).toBe(false);
    expect($('#home').classList.contains('show')).toBe(false);
  });

  it('el menú lista las secciones, marca la actual y desactiva Partida si no hay una abierta', () => {
    ($('#collb [data-nav]') as HTMLButtonElement).click();
    expect($('#navmenu').hidden).toBe(false);
    expect([...document.querySelectorAll('#navmenu [data-go]')].map(b => (b as HTMLElement).dataset.go)).toEqual(['inicio', 'partida', 'mazos', 'coleccion', 'mesa', 'intercambios']);
    expect($('#navmenu .navit.on')!.dataset.go).toBe('coleccion');
    expect(($('#navmenu [data-go="partida"]') as HTMLButtonElement).disabled).toBe(true);
    // Esc lo cierra
    $('#navmenu').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect($('#navmenu').hidden).toBe(true);
  });

  it('cambia de sección directo (de Colección a Mazos) y la dirección la sigue', async () => {
    ($('#collb [data-nav]') as HTMLButtonElement).click();
    ($('#navmenu [data-go="mazos"]') as HTMLButtonElement).click();
    await tick();
    expect($('#deckb').hidden).toBe(false);
    expect($('#collb').hidden).toBe(true);
    expect(location.hash).toBe('#/mazos');
  });

  it('los botones de siempre también actualizan la dirección', async () => {
    ($('#deckb [data-nav]') as HTMLButtonElement).click();
    ($('#navmenu [data-go="inicio"]') as HTMLButtonElement).click();
    await tick();
    expect(location.hash).toBe('#/inicio');
    ($('#hColl') as HTMLButtonElement).click();       // la tarjeta del inicio
    await tick();
    expect(location.hash).toBe('#/coleccion');
  });

  it('"atrás" del navegador vuelve a la sección anterior', async () => {
    history.pushState(null, '', location.pathname + '#/mazos');
    dispatchEvent(new PopStateEvent('popstate'));
    await tick();
    expect($('#deckb').hidden).toBe(false);
    expect($('#collb').hidden).toBe(true);
    // una dirección a una partida que ya no está abierta lleva al inicio
    history.pushState(null, '', location.pathname + '#/partida');
    dispatchEvent(new PopStateEvent('popstate'));
    await tick();
    expect($('#home').classList.contains('show')).toBe(true);
    expect(location.hash).toBe('#/inicio');
    expect(errors).toEqual([]);
  });

  it('las pestañas de la barra llevan a Intercambios y a En la mesa, y las cierran al ir a otra sección', async () => {
    expect(document.querySelectorAll('.appbar .navtabs').length).toBeGreaterThanOrEqual(5);
    ($('#deckb .navtab[data-tab="intercambios"]') as HTMLButtonElement).click();
    await tick();
    expect($('#trade').hidden).toBe(false);
    expect(location.hash).toBe('#/intercambios');
    expect($('#trade .navtab.on')!.dataset.tab).toBe('intercambios');
    ($('#trade .navtab[data-tab="mesa"]') as HTMLButtonElement).click();
    await tick();
    expect($('#trade').hidden).toBe(true);
    expect($('#mesa').hidden).toBe(false);
    expect(location.hash).toBe('#/mesa');
    ($('#mesa .navtab[data-tab="mazos"]') as HTMLButtonElement).click();
    await tick();
    expect($('#mesa').hidden).toBe(true);
    expect($('#deckb').hidden).toBe(false);
    expect(location.hash).toBe('#/mazos');
    expect(errors).toEqual([]);
  });
});
