// @vitest-environment jsdom
// Modo incrustado (las jugadas de las guías): app/?embed=1#play=<guion> abre ese guion sin inicio ni recientes.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DIANA_PLAYS } from '../src/guides/data/diana-plays';
import { playHash } from '../src/guides/render';

vi.mock('tesseract.js', () => ({ createWorker: async () => { throw new Error('sin OCR en pruebas'); } }));
const html = readFileSync(resolve(process.cwd(), 'app/index.html'), 'utf8');
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const errors: unknown[] = [];
const script = DIANA_PLAYS[1].script.en;

beforeAll(async () => {
  history.replaceState(null, '', '/app/?embed=1#play=' + playHash(script));
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  (Element.prototype as any).animate = () => ({ finished: Promise.resolve(), cancel() {} });
  (Element.prototype as any).scrollIntoView = () => {};
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    String(url).includes('riftcodex') ? { ok: true, json: async () => ({ items: [], pages: 1 }) } : { ok: false, json: async () => null }));
  addEventListener('error', e => errors.push(e.error));
  await import('../src/main');
  await new Promise(r => setTimeout(r, 50));
});

describe('modo incrustado', () => {
  it('abre el guion del enlace, sin el inicio ni el recorrido', () => {
    expect(document.documentElement.classList.contains('embed')).toBe(true);
    expect($('#home').classList.contains('show')).toBe(false);
    expect(($('#script') as HTMLTextAreaElement).value).toBe(script);
    expect($('#errors').textContent).toBe('');
    expect($('#tour').classList.contains('show')).toBe(false);
    expect(errors).toEqual([]);
  });
  it('no guarda nada en recientes', async () => {
    const { IDB } = await import('../src/app/cards.js');
    const keys = (await IDB.entries().catch(() => [])).map(([k]: [string]) => k);
    expect(keys.filter((k: string) => k.startsWith('recent:'))).toEqual([]);
  });
});
