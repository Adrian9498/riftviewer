// @vitest-environment jsdom
// La app en un teléfono (pantalla angosta, sin ratón): partida en 9:16 con la mesa a pantalla completa,
// y el constructor en dos pantallas (Cartas / Mi mazo).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('tesseract.js', () => ({ createWorker: async () => { throw new Error('sin OCR'); } }));
const html = readFileSync(resolve(process.cwd(), 'app/index.html'), 'utf8');
const $ = (s: string) => document.querySelector(s) as HTMLElement;

beforeAll(async () => {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  (Element.prototype as any).animate = () => ({ finished: Promise.resolve(), cancel() {} });
  (Element.prototype as any).scrollIntoView = () => {};
  (globalThis as any).CSS = { escape: (s: string) => s };
  localStorage.clear();
  localStorage.setItem('rb_fmt', 'h');   // en la PC eligió 16:9: no debe afectar al teléfono
  // un teléfono: pantalla angosta y sin ratón
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: /max-width: 760px|hover: none/.test(q), media: q, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => null })));
  await import('../src/main');
  await new Promise(r => setTimeout(r, 20));
});

describe('en el teléfono', () => {
  it('la partida arranca en 9:16 aunque en la PC se use 16:9', () => {
    expect($('#stage').className).toBe('v');
  });
  it('la mesa ocupa toda la pantalla: el panel de jugadas arranca cerrado', () => {
    expect(document.body.classList.contains('nopanel')).toBe(true);
  });
  it('cambiar el formato en el teléfono se guarda aparte, sin tocar el de la PC', () => {
    ($('#fmtseg [data-f="h"]') as HTMLButtonElement).click();
    expect(localStorage.getItem('rb_fmt_m')).toBe('h');
    expect(localStorage.getItem('rb_fmt')).toBe('h');
    ($('#fmtseg [data-f="v"]') as HTMLButtonElement).click();
    expect(localStorage.getItem('rb_fmt_m')).toBe('v');
    expect(localStorage.getItem('rb_fmt')).toBe('h');
  });
  it('el panel de jugadas y Ajustes son hojas: abrir una cierra la otra', () => {
    ($('#bPanel') as HTMLButtonElement).click();
    expect(document.body.classList.contains('nopanel')).toBe(false);
    ($('#bSettings') as HTMLButtonElement).click();
    expect(document.body.classList.contains('noinsp')).toBe(false);
    expect(document.body.classList.contains('nopanel')).toBe(true);
    ($('#bPanel') as HTMLButtonElement).click();
    expect(document.body.classList.contains('noinsp')).toBe(true);
    ($('#bPanelX') as HTMLButtonElement).click();
    expect(document.body.classList.contains('nopanel')).toBe(true);
  });
  it('el constructor cambia entre Cartas y Mi mazo, y los filtros se despliegan', () => {
    ($('#hDecks') as HTMLButtonElement).click();
    ($('#dlNew') as HTMLButtonElement).click();
    expect($('#deckb').dataset.pane).toBe('cat');
    ($('.dbpanes [data-pane="deck"]') as HTMLButtonElement).click();
    expect($('#deckb').dataset.pane).toBe('deck');
    expect($('#dbPaneN').textContent).toBe('0/40');
    // "Elige una leyenda" en el mazo lleva al catálogo ya filtrado
    ($('#dbPanel [data-filter="Legend"]') as HTMLButtonElement).click();
    expect($('#deckb').dataset.pane).toBe('cat');
    expect(($('#dbType') as HTMLSelectElement).value).toBe('Legend');
    ($('#dbFiltBtn') as HTMLButtonElement).click();
    expect($('#deckb .dbfilters').classList.contains('open')).toBe(true);
  });
});
