// @vitest-environment jsdom
// Prueba de la pantalla del constructor de mazos sobre el index.html real, con un catálogo pequeño de riftcodex.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'app/index.html'), 'utf8');
const item = (id: string, name: string, type: string, supertype: string | null, domain: string[], tags: string[] = [], energy: number | null = 2) => ({
  name, riftbound_id: id, classification: { type, supertype, domain, rarity: 'Common' }, attributes: { energy, might: type === 'Unit' ? 3 : null, power: null },
  text: { plain: 'Texto de ' + name, rich: '' }, media: { image_url: `https://img/${id}.png` }, metadata: { alternate_art: false, signature: false, overnumbered: false },
  tags, set: { set_id: id.split('-')[0].toUpperCase() },
});
const items = [
  item('ogn-001-1', 'Diana, Scorn of the Moon', 'Legend', 'Champion', ['Mind', 'Chaos'], ['Diana'], null),
  item('ogn-002-1', 'Diana, Lunari', 'Unit', 'Champion', ['Chaos'], ['Diana'], 4),
  item('ogn-003-1', 'Jinx, Rebel', 'Unit', 'Champion', ['Fury'], ['Jinx'], 5),
  item('ogn-004-1', 'Stupefy', 'Spell', null, ['Mind'], [], 1),
  item('ogn-005-1', 'Rune of Mind', 'Rune', 'Basic', ['Mind'], [], null),
  item('ogn-006-1', 'Targon Peak', 'Battlefield', null, ['Colorless'], [], null),
];

let errors: unknown[] = [];
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const tile = (name: string) => [...document.querySelectorAll('#dbGrid .dbc')].find(t => t.getAttribute('title') === name) as HTMLElement;

beforeAll(async () => {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  (Element.prototype as any).animate = () => ({ finished: Promise.resolve(), cancel() {} });
  (Element.prototype as any).scrollIntoView = () => {};
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    String(url).includes('riftcodex') ? { ok: true, json: async () => ({ items, pages: 1 }) } : { ok: false, json: async () => null }));
  addEventListener('error', e => errors.push(e.error));
  await import('../src/main');
  await new Promise(r => setTimeout(r, 20));
});

describe('constructor de mazos', () => {
  it('abre desde el inicio con un mazo nuevo y el catálogo cargado', () => {
    ($('#hDecks') as HTMLButtonElement).click();
    expect(($('#deckb') as HTMLElement).hidden).toBe(false);
    // sin mazos, la galería invita a crear el primero
    expect($('#deckb').dataset.view).toBe('lib');
    expect($('#dlGrid').textContent).toContain('Todavía no tienes mazos');
    ($('#dlGrid [data-new]') as HTMLButtonElement).click();
    expect($('#deckb').dataset.view).toBe('edit');
    expect(document.querySelectorAll('#dbGrid .dbc').length).toBe(items.length);
    expect(errors).toEqual([]);
  });

  it('la leyenda filtra por sus dominios y el primer campeón suyo se vuelve el elegido', () => {
    tile('Diana, Scorn of the Moon').click();
    expect(tile('Jinx, Rebel')).toBeUndefined();          // Furia: fuera de Mente y Caos
    tile('Diana, Lunari').click();
    expect($('#dbPanel').textContent).toContain('Campeón elegido');
    expect($('#dbPanel').querySelector('.dbr[data-code="OGN-002"]')).not.toBeNull();
    for (let k = 0; k < 4; k++) tile('Stupefy').click();   // la cuarta copia se rechaza
    expect(tile('Stupefy').querySelector('.dbn')!.textContent).toBe('3');
  });

  it('runas, campos y revisión de reglas', () => {
    tile('Rune of Mind').click(); tile('Targon Peak').click(); tile('Targon Peak').click();
    expect($('#dbPanel').querySelectorAll('[data-sec="battlefields"]').length).toBe(1);   // no repite campos
    ($('.dbtabs [data-dt="check"]') as HTMLButtonElement).click();
    const txt = $('#dbPanel').textContent!;
    expect(txt).toMatch(/Faltan 36 cartas/);
    expect(txt).toMatch(/Faltan 11 runas/);
    expect(txt).toMatch(/Elige 3 campos/);
  });

  it('exporta en el formato del simulador y el enlace vuelve a abrir el mismo mazo', async () => {
    // "Listo" lleva a la página del mazo, que tiene Exportar; luego se vuelve a editar
    ($('#dbBack') as HTMLButtonElement).click();
    expect($('#deckb').dataset.view).toBe('detail');
    ($('#ddExport') as HTMLButtonElement).click();
    ($('#ddEdit') as HTMLButtonElement).click();
    const txt = ($('#modal textarea') as HTMLTextAreaElement).value;
    expect(txt).toMatch(/^Legend:\n1 Diana, Scorn of the Moon \[OGN-001\]\n\nChampion:\n1 Diana, Lunari \[OGN-002\]\n\nMainDeck:\n3 Stupefy \[OGN-004\]/);
    const fmt = await import('../src/deck/format');
    const d = fmt.decodeDeck(fmt.encodeDeck(fmt.fromText(txt, 'x', (n: string, c?: string) => c || null).deck), 'y')!;
    expect(d.main).toEqual({ 'OGN-004': 3 });
    expect(d.runes).toEqual({ 'OGN-005': 1 });
  });

  it('mano de prueba: roba del mazo principal y permite mulligan de hasta 2', () => {
    ($('.dbtabs [data-dt="test"]') as HTMLButtonElement).click();
    const hand = () => document.querySelectorAll('#dbPanel .simc');
    expect(hand().length).toBe(3);                       // el mazo solo tiene 3 Stupefy (el campeón no se roba)
    (hand()[0] as HTMLElement).click();
    expect(hand()[0].classList.contains('pick')).toBe(true);
    ($('[data-sim="mull"]') as HTMLButtonElement).click();
    // con solo 3 cartas no hay qué robar: la devuelta va al fondo y se puede robar después
    expect(hand().length).toBe(2);
    expect(document.querySelector('[data-sim="mull"]')).toBeNull();   // el mulligan solo se hace una vez
    ($('[data-sim="draw"]') as HTMLButtonElement).click();
    expect(hand().length).toBe(3);
    expect(($('[data-sim="draw"]') as HTMLButtonElement).disabled).toBe(true);   // ya no quedan cartas
    ($('.dbtabs [data-dt="list"]') as HTMLButtonElement).click();
  });

  it('guarda el mazo como proyecto para que se sincronice', async () => {
    await new Promise(r => setTimeout(r, 350));
    const keys = Object.keys(localStorage).filter(k => k.startsWith('rb_proj_deck:'));
    expect(keys.length).toBe(1);
    expect(JSON.parse(localStorage.getItem(keys[0])!).legend).toBe('OGN-001');
    expect(errors).toEqual([]);
  });
});

describe('mis mazos', () => {
  const stored = () => { const k = Object.keys(localStorage).find(k => k.startsWith('rb_proj_deck:'))!; return JSON.parse(localStorage.getItem(k)!); };

  it('al terminar de editar se guarda la versión con lo que entró', () => {
    ($('#dbBack') as HTMLButtonElement).click();
    const h = stored().history;
    expect(h).toHaveLength(1);
    expect(h[0].add).toMatchObject({ 'OGN-001': 1, 'OGN-002': 1, 'OGN-004': 3 });
    expect($('#ddBody').textContent).toContain('Primera versión');
    // quitar una copia y volver: segunda versión con lo que salió
    ($('#ddEdit') as HTMLButtonElement).click();
    ($('#dbPanel [data-rm="OGN-004"][data-sec="main"]') as HTMLButtonElement).click();
    ($('#dbBack') as HTMLButtonElement).click();
    expect(stored().history[0].rm).toEqual({ 'OGN-004': 1 });
    expect($('#ddBody').textContent).toContain('Versión 2');
  });

  it('la página del mazo anota partidas, notas, favorito y carpeta', async () => {
    ($('#ddBody [data-res="w"][data-delta="1"]') as HTMLButtonElement).click();
    ($('#ddBody [data-res="w"][data-delta="1"]') as HTMLButtonElement).click();
    ($('#ddBody [data-res="l"][data-delta="1"]') as HTMLButtonElement).click();
    expect(stored().record).toEqual({ w: 2, l: 1 });
    expect($('#ddBody').textContent).toContain('67% de victorias');
    const notes = $('#ddNotes') as HTMLTextAreaElement;
    notes.value = 'Mulligan agresivo'; notes.dispatchEvent(new Event('input', { bubbles: true }));
    notes.dispatchEvent(new Event('focusout', { bubbles: true }));
    expect(stored().notes).toBe('Mulligan agresivo');
    ($('#ddBody [data-fav]') as HTMLButtonElement).click();
    expect(stored().fav).toBe(true);
    ($('#ddBody [data-move]') as HTMLButtonElement).click();
    ($('#dlNewF') as HTMLInputElement).value = ' Torneo ';
    ([...document.querySelectorAll('#modal .mfoot .btn')].find(b => b.textContent === 'Crear y mover') as HTMLButtonElement).click();
    expect(stored().folder).toBe('Torneo');
  });

  it('la galería muestra la tarjeta del mazo y filtra por carpeta', () => {
    ($('#ddBack') as HTMLButtonElement).click();
    expect($('#deckb').dataset.view).toBe('lib');
    const card = $('#dlGrid .dlc');
    expect(card.textContent).toContain('Diana, Scorn of the Moon');
    expect(card.textContent).toContain('2-1');
    expect(card.querySelector('.dlfav.on')).not.toBeNull();
    expect([...document.querySelectorAll('#dlSide [data-folder]')].map(b => b.textContent)).toEqual(['Todos1', 'Torneo1']);
    // duplicar desde su página: la copia empieza sin récord
    card.click();
    ($('#ddDup') as HTMLButtonElement).click();
    expect($('#ddBody h1').textContent).toMatch(/\(copia\)$/);
    ($('#ddBack') as HTMLButtonElement).click();
    expect(document.querySelectorAll('#dlGrid .dlc')).toHaveLength(2);
    expect(errors).toEqual([]);
  });

  const live = () => Object.keys(localStorage).filter(k => k.startsWith('rb_proj_deck:')).map(k => JSON.parse(localStorage.getItem(k)!)).filter(d => !d.deleted);
  const modalBtn = (label: string) => [...document.querySelectorAll('#modal .mfoot .btn')].find(b => b.textContent === label) as HTMLButtonElement;
  const folderBtn = (name: string) => [...document.querySelectorAll('#dlSide [data-folder]')].find(b => b.textContent!.startsWith(name)) as HTMLButtonElement;

  it('las carpetas se renombran y se borran sin perder sus mazos', () => {
    folderBtn('Torneo').click();
    ($('#dlSide [data-frename]') as HTMLButtonElement).click();
    ($('#dlRenF') as HTMLInputElement).value = 'Liga';
    modalBtn('Guardar').click();
    expect(live().map(d => d.folder)).toEqual(['Liga', 'Liga']);
    expect(folderBtn('Liga').classList.contains('on')).toBe(true);
    ($('#dlSide [data-fdel]') as HTMLButtonElement).click();
    modalBtn('Solo la carpeta').click();
    expect(live()).toHaveLength(2);
    expect(live().every(d => !d.folder)).toBe(true);
    expect($('#dlSide [data-fdel]')).toBeNull();
  });

  it('un mazo se borra desde su tarjeta, después de confirmar', () => {
    ($('#dlGrid [data-del]') as HTMLButtonElement).click();
    expect($('#modal').classList.contains('show')).toBe(true);
    modalBtn('Cancelar').click();
    expect(live()).toHaveLength(2);
    ($('#dlGrid [data-del]') as HTMLButtonElement).click();
    modalBtn('Borrar').click();
    expect(live()).toHaveLength(1);
    expect(document.querySelectorAll('#dlGrid .dlc')).toHaveLength(1);
    // y desde su página: vuelve a la galería vacía
    ($('#dlGrid .dlc') as HTMLElement).click();
    ($('#ddDel') as HTMLButtonElement).click();
    modalBtn('Borrar').click();
    expect($('#deckb').dataset.view).toBe('lib');
    expect($('#dlGrid').textContent).toContain('Todavía no tienes mazos');
    expect(errors).toEqual([]);
  });
});
