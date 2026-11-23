// @vitest-environment jsdom
// Si riftcodex no responde, las cartas salen de OpenRift: los mazos siguen teniendo leyenda y campeón y la importación funciona.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('tesseract.js', () => ({ createWorker: async () => { throw new Error('sin OCR en pruebas'); } }));
const html = readFileSync(resolve(process.cwd(), 'app/index.html'), 'utf8');
const catalog = JSON.parse(readFileSync(resolve(process.cwd(), 'public/openrift-catalog.json'), 'utf8'));
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const errors: unknown[] = [];
const LIST = `Legend:
1 Diana, Scorn of the Moon

Champion:
1 Diana, Lunari

MainDeck:
3 Stupefy
3 Ravenbloom Student
3 Gust
3 Ride the Wind
3 Tideturner
3 Moonfall
2 Traveling Merchant
2 Hard Bargain
2 Star-Crossed
2 The Good Stuff
2 Bedeviling Stranger
1 Smoke Screen
1 Rebuke
1 Eclipse
1 An Offer You Can't Refuse
3 Hwei, Brooding Painter
2 Vex, Apathetic
1 Fizz, Trickster
1 Vex, Cheerless

Battlefields:
1 Targon's Peak
1 Ravenbloom Conservatory
1 Abandoned Hall

Runes:
6 Mind Rune
6 Chaos Rune

Sideboard:
3 Sprite Fountain
2 Sprite Burst
2 Decree of Insight
1 Abandon
1 Baron Nashor
1 An Offer You Can't Refuse`;

beforeAll(async () => {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  (Element.prototype as any).animate = () => ({ finished: Promise.resolve(), cancel() {} });
  (Element.prototype as any).scrollIntoView = () => {};
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('riftcodex')) throw new Error('riftcodex caído');
    return String(url).includes('openrift-catalog') ? { ok: true, json: async () => catalog } : { ok: false, json: async () => null };
  }));
  addEventListener('error', e => errors.push(e.error));
  await import('../src/main');
  await new Promise(r => setTimeout(r, 50));
});

describe('riftcodex caído', () => {
  it('importar una lista completa arma el mazo con leyenda, campeón y todas las cartas', () => {
    ($('#hDecks') as HTMLButtonElement).click();
    ($('#dlImport') as HTMLButtonElement).click();
    ($('#dbImp') as HTMLTextAreaElement).value = LIST;
    ([...document.querySelectorAll('#modal .mfoot .btn')].find(b => b.textContent === 'Importar') as HTMLButtonElement).click();
    const d = Object.keys(localStorage).filter(k => k.startsWith('rb_proj_deck:')).map(k => JSON.parse(localStorage.getItem(k)!))[0];
    expect(d.legend).toBeTruthy();
    expect(d.champion).toBeTruthy();
    const n = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
    expect(n(d.main)).toBe(39);
    expect(n(d.runes)).toBe(12);
    expect(d.battlefields).toHaveLength(3);
    expect(n(d.side)).toBe(10);
    expect(errors).toEqual([]);
  });
});
