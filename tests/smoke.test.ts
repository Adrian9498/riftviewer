// @vitest-environment jsdom
// Prueba de humo: carga la app completa sobre el index.html real y reproduce un guion y un replay
// sintético de punta a punta. Detecta errores de orden de carga entre módulos, referencias rotas
// y excepciones en el render, sin abrir un navegador.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

// convierte un objeto normal al formato de grafo de RiftAtlas (cada objeto/lista es un nodo)
function encodeReplay(root: unknown) {
  const nodes: unknown[] = [];
  const enc = (v: unknown): unknown => {
    if (Array.isArray(v)) { const i = nodes.push(null) - 1; nodes[i] = ['a', v.map(enc)]; return { r: i }; }
    if (v && typeof v === 'object') { const i = nodes.push(null) - 1; nodes[i] = ['o', Object.entries(v).map(([k, x]) => [k, enc(x)])]; return { r: i }; }
    return v;
  };
  return { format: 'riftatlas-replay', version: 2, nodes, root: enc(root) };
}
const card = (id: string, name: string, code: string, type = 'unit', exhausted = false) =>
  ({ id, name, cardCode: code, type, exhausted, ownerPlayerId: id.startsWith('a') ? 'pa' : 'pb' });
function frame(n: number, opts: { aBase?: object[]; aField?: object[]; bField?: object[]; aScore?: number; active?: string; log?: string; phase?: string; hand?: object[]; arrows?: object; xp?: number }) {
  const board = (legend: object, base: object[], field: object[], score: number) =>
    ({ legend: [legend], champion: [], base, hand: opts.hand || [card('h' + n, 'Stupefy', 'OGN-095', 'spell')], trash: [], deck: [], runeArea: [], legendXp: opts.xp || 0, floatingEnergy: 1,
      battlefieldA: field, battlefieldB: [], battlefieldC: [], battlefieldToken: [], score });
  return {
    actionType: 'move_card', elapsedMs: n * 1000,
    state: {
      phase: opts.phase || 'in_game', targetArrowsByPlayer: opts.arrows || {}, turnNumber: 1 + (n >> 1), activeTurnPlayerId: opts.active || 'pa', chainEntries: [],
      log: opts.log ? [{ id: 'l' + n, text: opts.log, at: n, authorPlayerId: 'pa', turnNumber: 1 }] : [],
      players: [
        { id: 'pa', name: 'Ana', seat: 0, selectedBattlefield: 'Campo Uno', selectedBattlefieldCardCode: 'OGN-001', board: board(card('aL', 'Leyenda A', 'UNL-234', 'legend'), opts.aBase || [], opts.aField || [], opts.aScore || 0) },
        { id: 'pb', name: 'Beto', seat: 1, selectedBattlefield: 'Campo Dos', selectedBattlefieldCardCode: 'OGN-002', board: board(card('bL', 'Leyenda B', 'UNL-197', 'legend'), [], opts.bField || [], 0) },
      ],
    },
  };
}
const u1 = card('a1', 'Unidad Uno', 'OGN-010'), u2 = card('b1', 'Unidad Dos', 'OGN-020');
const replay = encodeReplay({
  replayId: 'smoke:1', viewerPlayerId: 'pa',
  frames: [
    frame(0, { phase: 'mulligan', hand: [card('m1', 'Uno', 'OGN-095'), card('m2', 'Dos', 'OGN-095')] }),
    frame(0, { hand: [card('m1', 'Uno', 'OGN-095'), card('m3', 'Tres', 'OGN-095')] }),
    frame(1, { aBase: [u1], log: 'Ana played Unidad Uno from hand to base.' }),
    frame(2, { aField: [u1], log: 'Ana moved Unidad Uno to Campo Uno.' }),
    frame(3, { aField: [u1], bField: [u2], active: 'pb', xp: 1, arrows: { pb: [{ sourceAnchor: 'chain', sourceCardId: 'chain-pb-x', targetAnchor: 'board', targetCardId: 'a1' }] } }),
    frame(4, { aField: [{ ...u1, exhausted: true }], aScore: 1, log: 'Ana conquered Campo Uno and scored 1.' }),
  ],
});

let errors: unknown[] = [];
let shell: any, engine: any, render: any, state: any, demo: any;

beforeAll(async () => {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  // lo que jsdom no trae
  (Element.prototype as any).animate = () => ({ finished: Promise.resolve(), cancel() {} });
  (Element.prototype as any).scrollIntoView = () => {};
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number;
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    String(url).includes('riftcodex') ? { ok: true, json: async () => ({ items: [], pages: 1 }) } : { ok: false, json: async () => null }));
  addEventListener('error', e => errors.push(e.error));
  addEventListener('unhandledrejection', e => errors.push(e.reason));
  await import('../src/main');
  shell = await import('../src/app/shell.js');
  engine = await import('../src/app/script-engine.js');
  render = await import('../src/app/replay-render.js');
  state = (await import('../src/app/state')).app;
  demo = await import('../src/app/demo.js');
  state.speed = 1000;   // animaciones casi instantáneas
});

describe('app completa', () => {
  it('arranca mostrando la pantalla de inicio', () => {
    expect(document.querySelector('#home')!.classList.contains('show')).toBe(true);
    expect(errors).toEqual([]);
  });

  it('reproduce el guion de ejemplo completo', async () => {
    shell.openScript(demo.DEMO, 'Ejemplo');
    await new Promise(r => setTimeout(r, 20));
    expect(engine.STEPS.length).toBeGreaterThan(30);
    state.playing = true;
    let guard = 0;
    while (engine.idx < engine.STEPS.length && guard++ < 200) await engine.stepForward();
    state.playing = false;
    expect(engine.idx).toBe(engine.STEPS.length);
    expect(document.querySelector('#errors')!.textContent).toBe('');
    expect(document.querySelector('#victory')!.classList.contains('show')).toBe(true);
    expect(errors).toEqual([]);
  }, 30000);

  for (const [fmt, lay] of [['h', 'lanes'], ['h', 'lat'], ['h', 'classic'], ['v', 'lanes'], ['v', 'classic']]) {
    it(`reproduce un replay en ${fmt === 'h' ? '16:9' : '9:16'} con la distribución "${lay}"`, async () => {
      (document.querySelector('#rlay') as HTMLSelectElement).value = lay;
      document.querySelector('#stage')!.className = fmt;
      expect(shell.openReplay(JSON.parse(JSON.stringify(replay)), 'Prueba')).toBe(true);
      render.rJump(0);
      state.playing = true;
      while (state.R.i < state.R.frames.length - 1) await render.rStep();
      state.playing = false;
      expect(state.R.i).toBe(5);
      expect(state.R.mull).toMatchObject({ start: 0, end: 1 });
      expect(state.R.mull.players.pa.returned).toEqual(['m2']);
      expect(document.querySelectorAll('#rboard .card').length).toBeGreaterThan(3);
      expect(document.querySelectorAll('#rfields .rfield').length).toBe(2);
      expect(document.querySelector('#rfields .rfield.ctrl')).not.toBeNull();   // Ana controla el campo A
      // línea de tiempo: una sección para el mulligan y otra por turno, con la jugada actual marcada
      expect(document.querySelector('#frames .tturn[data-sec="mull"]')).not.toBeNull();
      expect(document.querySelectorAll('#frames .tl').length).toBe(state.R.frames.length);
      expect(document.querySelector(`#frames .tl.cur[data-i="${state.R.i}"]`)).not.toBeNull();
      // barra de reproducción: posición en palabras y la conquista marcada sobre la línea
      expect(document.querySelector('#pos')!.textContent).toMatch(/^Turno \d/);
      expect(document.querySelector('#smarks .mk-conq')).not.toBeNull();
      // Exportar: se elige en palabras y el resumen dice cuántas jugadas se grabarán
      Object.assign(navigator, { mediaDevices: { getDisplayMedia: () => Promise.reject(new Error('sin pantalla')) } });
      (window as any).MediaRecorder = class {};
      (document.querySelector('#bExport') as HTMLButtonElement).click();
      const presets = [...document.querySelectorAll('#modal .preset')].map(b => (b as HTMLElement).dataset.p);
      expect(presets).toEqual(['all', 'here', 'play', 'clips', 'turns']);
      expect(document.querySelector('#modal .preset.on')).not.toBeNull();
      expect(document.querySelector('#exSum')!.textContent).toMatch(/Se grabarán \d+ jugada/);
      (document.querySelector('#modal .preset[data-p="turns"]') as HTMLButtonElement).click();
      expect((document.querySelector('#modal .exturns') as HTMLElement).hidden).toBe(false);
      expect([...document.querySelectorAll('#exFrom option')].map(o => o.textContent)).toContain('Mulligan');
      expect(errors).toEqual([]);
    }, 30000);
  }
});
