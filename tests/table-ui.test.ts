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
  cards: { c1: { name: 'Amateur Demolitionist', types: ['unit'], superTypes: [] }, c2: { name: 'Brawl', types: ['spell'], superTypes: [] }, c3: { name: 'Rengar', types: ['legend'], superTypes: [] } },
  printings: { a: pr('RAD-001', 'c1'), c: pr('RAD-004', 'c2'), l: pr('RAD-200', 'c3') },
};
const rc = (id: string, name: string, type: string, text: string, energy: number, might: number | null) => ({
  name, classification: { type, supertype: null, domain: ['Fury'], rarity: 'Common' }, media: { image_url: 'https://x/' + id + '.png' },
  text: { plain: text, rich: text }, attributes: { energy, might, power: null }, metadata: {}, tags: [], collector_number: 1, riftbound_id: id + '-1', set: { set_id: 'RAD' },
});
const items = [rc('rad-001', 'Amateur Demolitionist', 'Unit', 'When you play me, deal 2 to a unit.', 3, 2), rc('rad-004', 'Brawl', 'Spell', 'Two units fight.', 2, null), rc('rad-200', 'Rengar', 'Legend', 'Hunt.', 0, null), { ...rc('rad-299', 'Rengar (Signature)', 'Legend', 'Hunt.', 0, null), metadata: { signature: true } }];

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const errors: unknown[] = [];
const esc = () => dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
const search = (sel: string, q: string) => { const i = $(sel) as HTMLInputElement; i.value = q; i.dispatchEvent(new Event('input', { bubbles: true })); };

beforeAll(async () => {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  (Element.prototype as any).animate = () => ({ finished: Promise.resolve(), cancel() {} });
  (Element.prototype as any).scrollIntoView = () => {};
  localStorage.clear();
  localStorage.setItem('rb_proj_deck:m1', JSON.stringify({ id: 'm1', name: 'Diana', legend: null, champion: null, main: {}, runes: {}, battlefields: [], side: {}, updatedAt: 1, notes: 'Mulligan: busca unidades de 2', record: { w: 1, l: 0 } }));
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

  it('elige el mazo y la leyenda rival de una lista y anota el resultado contra ella', async () => {
    const deck = () => JSON.parse(localStorage.getItem('rb_proj_deck:m1')!);
    // sin mazo elegido no se anota
    ($('#msEnd [data-msres="w"]') as HTMLButtonElement).click();
    expect(deck().games).toBeUndefined();
    // en vez de anotar, abre la lista de tus mazos
    expect($('#msPick').hidden).toBe(false);
    expect($('#mspGrid').textContent).toContain('Diana');
    ($('#mspGrid [data-mspi="m1"]') as HTMLButtonElement).click();
    expect($('#msPick').hidden).toBe(true);
    expect($('#msGame [data-mspickdeck]').textContent).toContain('Diana');
    expect($('#msDeck').textContent).toContain('Diana');
    expect($('#msGame .msnotes').textContent).toContain('busca unidades de 2');
    // la leyenda del rival, de la lista (con buscador)
    ($('#msGame [data-mspickopp]') as HTMLButtonElement).click();
    const q = $('#mspQ') as HTMLInputElement; q.value = 'reng'; q.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelectorAll('#mspGrid [data-mspi]')).toHaveLength(1);
    ($('#mspGrid [data-mspi="RAD-200"]') as HTMLButtonElement).click();
    expect($('#msGame [data-mspickopp] .mssl b').textContent).toBe('Rengar');
    expect($('#msGame [data-mspickopp]').textContent).toContain('Primera vez');
    // una carta normal escaneada va a la tira; gané: se anota y la tira se limpia, la leyenda se queda
    search('#msQ', 'RAD 004'); ($('#msHits [data-mspick="RAD-004"]') as HTMLButtonElement).click();
    ($('#msEnd [data-msres="w"]') as HTMLButtonElement).click();
    const g = deck().games;
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ result: 'w', opp: { legendCode: 'RAD-200', legendName: 'Rengar' }, seen: ['RAD-004'] });
    expect($('#msSeen').textContent).toBe('');
    expect($('#msEnd .mslast').textContent).toContain('2-0');
    expect($('#msGame [data-mspickopp]').textContent).toContain('1-0');
    ($('#msEnd [data-msres="l"]') as HTMLButtonElement).click();
    expect($('#msGame [data-mspickopp]').textContent).toContain('1-1');
    // deshacer quita la última
    ($('#msEnd [data-msundo]') as HTMLButtonElement).click();
    expect(deck().games).toHaveLength(1);
    expect($('#msGame [data-mspickopp]').textContent).toContain('1-0');
  });

  it('en la página del mazo cuenta en el récord y contra cada leyenda', async () => {
    esc();
    ($('#hDecks') as HTMLButtonElement).click();
    ([...document.querySelectorAll('#dlGrid .dlc')].find(t => t.textContent!.includes('Diana')) as HTMLElement).click();
    expect($('#ddBody .ddkpis').textContent).toContain('2-0');
    expect($('#ddBody .ddmu').textContent).toContain('Rengar');
    expect($('#ddBody').textContent).toContain('1 en la mesa');
    // desde el mazo, la mesa abre con ese mazo elegido
    ($('#ddBody [data-mesa]') as HTMLButtonElement).click();
    expect($('#msGame [data-mspickdeck]').textContent).toContain('Diana');
    // en la lista de leyendas, primero las que ya enfrentaste, con tu récord
    ($('#msGame [data-mspickopp]') as HTMLButtonElement).click();
    expect(($('#mspGrid .mspi') as HTMLElement).dataset.mspi).toBe('RAD-200');
    expect($('#mspGrid .mspi em').textContent).toContain('1-0');
    esc();
    expect($('#msPick').hidden).toBe(true);
    expect($('#mesa').hidden).toBe(false);
  });

  it('todo va en tres pestañas; la leyenda rival y el reloj quedan siempre arriba', () => {
    const tab = () => ($('#mesa .mstabs [aria-selected="true"]') as HTMLElement).dataset.mstab;
    const shown = () => [...document.querySelectorAll('#mesa .mspan')].filter(p => !(p as HTMLElement).hidden).map(p => p.id);
    ($('#mstab-tools') as HTMLButtonElement).click();
    expect(tab()).toBe('tools');
    expect(shown()).toEqual(['msp-tools']);
    // al buscar una carta del rival se pasa sola a su pestaña
    search('#msQ', 'RAD 001'); ($('#msHits [data-mspick="RAD-001"]') as HTMLButtonElement).click();
    expect(shown()).toEqual(['msp-cards']);
    expect($('#msSeenN').textContent).toBe('1');
    // la leyenda rival en la barra de arriba lleva a la partida
    ($('#msChips .mschip') as HTMLButtonElement).click();
    expect(shown()).toEqual(['msp-game']);
    expect($('#msChips .mschip.clock')).toBeNull();   // el reloj aparece cuando se usa
    ($('#mstab-tools') as HTMLButtonElement).click();
  });

  it('moneda, dado y reloj de ronda', () => {
    ($('#msTools [data-mscoin]') as HTMLButtonElement).click();
    expect(['Cara', 'Cruz']).toContain($('#msTools .msroll b').textContent);
    ($('#msTools [data-msdie]') as HTMLButtonElement).click();
    expect(+$('#msTools .msroll b').textContent!).toBeGreaterThanOrEqual(1);
    expect(+$('#msTools .msroll b').textContent!).toBeLessThanOrEqual(20);
    expect($('#msTools .msd20')).not.toBeNull();
    const min = $('#msMin') as HTMLSelectElement; min.value = '30'; min.dispatchEvent(new Event('change', { bubbles: true }));
    expect($('#msClockT').textContent).toBe('30:00');
    ($('#msTools [data-msclock]') as HTMLButtonElement).click();
    expect($('#msTools [data-msclock]').textContent).toContain('Pausar');
    expect($('#msChips .mschip.clock').textContent).toContain('30:00');
    ($('#msTools [data-msclock]') as HTMLButtonElement).click();
    expect($('#msTools [data-msclock]').textContent).toContain('Seguir');
    ($('#msTools [data-msclockreset]') as HTMLButtonElement).click();
    expect($('#msClockT').textContent).toBe('30:00');
    expect(errors).toEqual([]);
  });
});
