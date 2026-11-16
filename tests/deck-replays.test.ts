// @vitest-environment jsdom
// Repeticiones guardadas en un mazo: se suben a su página, se abren con un clic y se borran con él.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { REPLAY_FORMAT } from '../src/replay/decode';

const html = readFileSync(resolve(process.cwd(), 'app/index.html'), 'utf8');
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const tick = (ms = 20) => new Promise(r => setTimeout(r, ms));

// replay mínimo en el formato de grafo del simulador
function encodeReplay(root: unknown) {
  const nodes: unknown[] = [];
  const enc = (v: unknown): unknown => {
    if (Array.isArray(v)) { const i = nodes.push(null) - 1; nodes[i] = ['a', v.map(enc)]; return { r: i }; }
    if (v && typeof v === 'object') { const i = nodes.push(null) - 1; nodes[i] = ['o', Object.entries(v).map(([k, x]) => [k, enc(x)])]; return { r: i }; }
    return v;
  };
  return { format: REPLAY_FORMAT, version: 2, nodes, root: enc(root) };
}
const board = (legend: object, score: number) => ({ legend: [legend], champion: [], base: [], hand: [], trash: [], deck: [], runeArea: [], legendXp: 0, floatingEnergy: 0,
  battlefieldA: [], battlefieldB: [], battlefieldC: [], battlefieldToken: [], score });
const frame = (n: number, aScore: number) => ({
  actionType: 'move_card', elapsedMs: n * 1000,
  state: {
    phase: 'in_game', targetArrowsByPlayer: {}, turnNumber: 1 + n, activeTurnPlayerId: 'pa', chainEntries: [], log: [],
    gameOutcome: n === 1 ? { winnerPlayerIds: ['pa'] } : null,
    players: [
      { id: 'pa', name: 'Ana', seat: 0, selectedBattlefield: 'Campo Uno', board: board({ id: 'aL', name: 'Leyenda A', cardCode: 'UNL-234', type: 'legend', ownerPlayerId: 'pa' }, aScore) },
      { id: 'pb', name: 'Beto', seat: 1, selectedBattlefield: 'Campo Dos', board: board({ id: 'bL', name: 'Leyenda B', cardCode: 'UNL-197', type: 'legend', ownerPlayerId: 'pb' }, 0) },
    ],
  },
});
const replayText = JSON.stringify(encodeReplay({ replayId: 'mazo:1', viewerPlayerId: 'pa', frames: [frame(0, 0), frame(1, 8)] }));
const file = (name: string, text: string) => ({ name, text: async () => text }) as unknown as File;

const files = new Map<string, unknown>();
let errors: unknown[] = [];
let lib: any, nav: any;
const deck = () => JSON.parse(localStorage.getItem('rb_proj_deck:m1')!);

beforeAll(async () => {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  (Element.prototype as any).animate = () => ({ finished: Promise.resolve(), cancel() {} });
  (Element.prototype as any).scrollIntoView = () => {};
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number;
  localStorage.clear();
  localStorage.setItem('rb_proj_deck:m1', JSON.stringify({ id: 'm1', name: 'Mi mazo', legend: null, champion: null, main: {}, runes: {}, battlefields: [], side: {}, updatedAt: 1 }));
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => null })));
  addEventListener('error', e => errors.push(e.error));
  addEventListener('unhandledrejection', e => errors.push(e.reason));
  // jsdom no trae IndexedDB: los archivos van a un mapa en memoria
  const { IDB } = await import('../src/app/cards');
  Object.assign(IDB, {
    get: async (k: string) => files.get(k), set: async (k: string, v: unknown) => { files.set(k, v); }, del: async (k: string) => { files.delete(k); },
    entries: async () => [...files.entries()],
  });
  await import('../src/main');
  lib = await import('../src/app/decklib.js');
  nav = await import('../src/app/nav.js');
  await tick();
});

describe('repeticiones en un mazo', () => {
  it('se suben a la página del mazo con su resumen; lo que no es replay se rechaza', async () => {
    ($('#hDecks') as HTMLButtonElement).click();
    ($('#dlGrid .dlc') as HTMLElement).click();
    expect($('#deckb').dataset.view).toBe('detail');
    expect($('#ddBody [data-repadd]')).not.toBeNull();
    expect(await lib.addReplays([file('notas.json', '{"hola":1}'), file('rb-replay-final.json', replayText)])).toBe(1);
    const r = deck().replays;
    expect(r).toHaveLength(1);
    expect(r[0].meta.players.map((p: any) => p.name)).toEqual(['Ana', 'Beto']);
    expect(files.get(`rep:m1:${r[0].id}`)).toBe(replayText);
    expect($('#ddBody .ddrep').textContent).toContain('Ana vs Beto');
    // ganó Ana, que descargó el replay: cuenta como victoria en el récord y contra la leyenda de Beto
    expect(r[0].analysis).toMatchObject({ me: 'pa', result: 'w', opp: [{ name: 'Beto', legendName: 'Leyenda B' }] });
    expect($('#ddBody .ddrt.w').textContent).toBe('Victoria');
    expect($('#ddBody .ddkpis').textContent).toContain('1-0');
    expect($('#ddBody .ddmu').textContent).toContain('Leyenda B');
    // se puede dejar fuera del récord
    ($('#ddBody [data-repcount]') as HTMLButtonElement).click();
    expect(deck().replays[0].count).toBe(false);
    expect($('#ddBody .ddkpis').textContent).not.toContain('1-0');
    expect($('#ddBody .ddmu')).toBeNull();
    ($('#ddBody [data-repcount]') as HTMLButtonElement).click();
    expect($('#ddBody .ddkpis').textContent).toContain('1-0');
    // el mismo archivo otra vez no se duplica
    expect(await lib.addReplays([file('rb-replay-final.json', replayText)])).toBe(0);
    expect(deck().replays).toHaveLength(1);
  });

  it('al darle clic se abre la partida', async () => {
    ($('#ddBody .ddrep') as HTMLElement).click();
    await tick();
    expect(($('#deckb') as HTMLElement).hidden).toBe(true);
    expect($('#docname').textContent).toContain('Replay');
    expect(document.body.classList.contains('replay')).toBe(true);
    nav.go('mazos'); lib.renderLib();
    expect($('#deckb').dataset.view).toBe('detail');
  });

  it('se quitan del mazo, y borrar el mazo borra sus archivos', async () => {
    const id = deck().replays[0].id;
    ($(`#ddBody [data-repdel="${id}"]`) as HTMLButtonElement).click();
    ([...document.querySelectorAll('#modal .mfoot .btn')].find(b => b.textContent === 'Quitar') as HTMLButtonElement).click();
    await tick();
    expect(deck().replays).toEqual([]);
    expect(files.has(`rep:m1:${id}`)).toBe(false);
    await lib.addReplays([file('otra.json', replayText)]);
    expect([...files.keys()].filter(k => k.startsWith('rep:m1:'))).toHaveLength(1);
    ($('#ddDel') as HTMLButtonElement).click();
    ([...document.querySelectorAll('#modal .mfoot .btn')].find(b => b.textContent === 'Borrar') as HTMLButtonElement).click();
    await tick();
    expect([...files.keys()].filter(k => k.startsWith('rep:'))).toEqual([]);
    expect(errors).toEqual([]);
  });
  it('probabilidades de robo y comparar con otro mazo', () => {
    localStorage.setItem('rb_proj_deck:m2', JSON.stringify({ id: 'm2', name: 'Grande', legend: null, champion: null, main: { 'OGN-001': 3, 'OGN-002': 3, 'OGN-003': 3, 'OGN-004': 3 }, runes: {}, battlefields: [], side: {}, updatedAt: 2 }));
    localStorage.setItem('rb_proj_deck:m3', JSON.stringify({ id: 'm3', name: 'Chico', legend: null, champion: null, main: { 'OGN-001': 2, 'OGN-009': 1 }, runes: {}, battlefields: [], side: {}, updatedAt: 1 }));
    nav.go('mazos'); lib.renderLib();
    ([...document.querySelectorAll('#dlGrid .dlc')].find(t => t.textContent!.includes('Grande')) as HTMLElement).click();
    // la lista y el análisis van en pestañas; se abre en la lista
    const tabs = [...document.querySelectorAll('#ddBody [data-instab]')] as HTMLButtonElement[];
    expect(tabs.map(t => t.dataset.instab)).toEqual(['deck', 'perf', 'prob']);
    expect(tabs[0].textContent).toContain('12');
    expect($('#ddpan-deck').hidden).toBe(false);
    expect($('#ddpan-deck').textContent).toContain('Mazo principal');
    expect($('#ddpan-prob').hidden).toBe(true);
    tabs[1].click();
    expect($('#ddpan-perf').hidden).toBe(false);
    expect($('#ddpan-deck').hidden).toBe(true);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    tabs[2].click();
    const rows = () => [...document.querySelectorAll('#ddBody .ddtbl tbody tr')].map(r => [...r.querySelectorAll('td')].map(td => td.textContent!.trim()));
    // 12 cartas, 3 copias: 1 − (9·8·7·6)/(12·11·10·9) = 75% en la mano inicial
    const row = rows().find(r => r[0] === 'OGN-001')!;
    expect(row.slice(1, 3)).toEqual(['3', '75%']);
    const sel = $('#ddSeen') as HTMLSelectElement; sel.value = '10'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(($('#ddSeen') as HTMLSelectElement).value).toBe('10');
    expect(rows().find(r => r[0] === 'OGN-001')![4]).toBe('100%');
    ($('#ddBody [data-compare]') as HTMLButtonElement).click();
    const out = $('#ddCmpOut').textContent!;
    expect(out).toContain('Solo en este');
    expect(out).toContain('3 → 2');
    expect(out).toContain('OGN-009');
    expect(errors).toEqual([]);
  });
});
