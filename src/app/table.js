// En la mesa: para partidas presenciales con cartas en otro idioma (por ejemplo chino contra inglés).
// Escaneas la carta que jugó el rival (o escribes su número) y ves su nombre y su texto en inglés, en grande.
// Las cartas vistas quedan en una tira para volver a leerlas sin escanear otra vez.
import { searchPrintings } from '../collection/model';
import { cardTextHTML } from '../data/symbols';
import { norm } from '../data/text';
import { $, ic } from './base';
import { cardByCode } from './cards';
import { catalog } from './collection';
import { openScanner, releaseScanner, warmScanner } from './scanner';
import { toast } from './shell';
import { esc } from './utils';

const KEY = 'rb_mesa', FRESH = 6 * 3600 * 1000;   // una partida que quedó abierta hace más de 6 h ya no sirve
const TYPE_ES = { Unit: 'Unidad', Spell: 'Hechizo', Gear: 'Equipo', Legend: 'Leyenda', Battlefield: 'Campo de batalla', Rune: 'Runa', Token: 'Ficha' };
let M = null;      // { deck, seen: códigos (el más nuevo primero), cur, ts }
let lock = null;   // pantalla siempre encendida mientras está abierta

const ls = (v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(KEY) || 'null'); localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { return null; } };
const save = () => { M.ts = Date.now(); ls(M); };

/** Abre la mesa. deck: nombre del mazo con el que juegas (opcional, solo se muestra). */
export function openTable(deck = '') {
  const old = ls();
  M = old && Date.now() - (old.ts || 0) < FRESH && Array.isArray(old.seen) ? { ...old, deck: deck || old.deck || '' } : { deck, seen: [], cur: null };
  save();
  $('#mesa').hidden = false; document.body.classList.add('inmesa');
  $('#msQ').value = ''; $('#msHits').innerHTML = '';
  render();
  warmScanner().catch(() => {});
  keepAwake();
}
export function closeTable() {
  if (!M) return;
  M = null;
  $('#mesa').hidden = true; document.body.classList.remove('inmesa');
  lock?.release?.().catch?.(() => {}); lock = null;
  releaseScanner();
}
async function keepAwake() {
  try { if (M && !lock && document.visibilityState === 'visible') { lock = await navigator.wakeLock?.request('screen'); lock?.addEventListener?.('release', () => { lock = null; }); } } catch (e) { lock = null; }
}

/** Una carta vista: va al principio de la tira y se muestra. */
export function showCard(code) {
  if (!M) return;
  M.seen = [code, ...M.seen.filter(c => c !== code)].slice(0, 40);
  M.cur = code; save(); render();
  $('#msCard')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
}
function scan() {
  const cat = catalog(); if (!cat) { toast('Espera a que cargue el catálogo de cartas.'); return; }
  openScanner({ cat, lookup: true, pick: p => showCard(p.code) });
}
function newGame() { M.seen = []; M.cur = null; save(); render(); toast('Partida nueva', 'ok'); }

/** Lo que se sabe de la carta: el catálogo de impresiones (nombre, imagen) y el de Riftcodex (texto, energía, poder). */
function info(code) {
  const p = catalog()?.byCode.get(code), d = cardByCode(code, p?.name) || {};
  return { code, name: p?.name || d.name || code, img: p?.img || d.img || '', type: d.type || p?.type || '', e: d.e, m: d.m ?? d.might, pw: d.pw, text: d.text, rich: d.rich };
}
function cardHTML(code) {
  const c = info(code);
  const stats = [TYPE_ES[c.type] || c.type, c.e != null && `Energía ${c.e}`, c.m != null && `Poder ${c.m}`].filter(Boolean);
  return `<article class="mscard" id="msCard">
    <img src="${esc(c.img)}" alt="${esc(c.name)}">
    <div class="msinfo">
      <h2>${esc(c.name)}</h2>
      <div class="msmeta"><span>${esc(c.code)}</span>${stats.map(s => `<span>${esc(s)}</span>`).join('')}</div>
      ${c.text || c.rich ? `<div class="mstext" lang="en">${cardTextHTML(c.rich, c.text)}</div>` : '<p class="dlhint">Sin texto.</p>'}
    </div></article>`;
}
function render() {
  if (!M) return;
  $('#msDeck').textContent = M.deck ? `Jugando con ${M.deck}` : 'Partida presencial';
  const cur = M.cur && M.seen.includes(M.cur) ? M.cur : null;
  $('#msView').innerHTML = cur ? cardHTML(cur)
    : `<div class="msempty">${ic('camera')}<b>Escanea la carta que jugó tu rival</b><span>Funciona con cartas en chino, inglés u otro idioma: ves su nombre y su texto en inglés. Apunta al número de abajo de la carta.</span></div>`;
  $('#msSeen').innerHTML = M.seen.length ? `<div class="mshead"><h3>Cartas del rival en esta partida <small>${M.seen.length}</small></h3><button class="btn mini" data-msnew>${ic('replay')} Partida nueva</button></div>
    <div class="msstrip">${M.seen.map(code => { const c = info(code); return `<button class="msth${code === cur ? ' on' : ''}" data-mscard="${esc(code)}" title="${esc(c.name)}"><img src="${esc(c.img)}" alt="${esc(c.name)}" loading="lazy"><span>${esc(c.name)}</span></button>`; }).join('')}</div>` : '';
}

export function init() {
  $('#hMesa').onclick = () => openTable();
  $('#msClose').onclick = closeTable;
  $('#msScan').onclick = scan;
  $('#mesa').addEventListener('click', e => {
    const t = e.target.closest('[data-mscard]'); if (t) { showCard(t.dataset.mscard); return; }
    if (e.target.closest('[data-msnew]')) newGame();
  });
  $('#msQ').oninput = e => {
    const cat = catalog(); if (!cat) return;
    const hits = searchPrintings(e.target.value, cat.prints, norm, 8);
    $('#msHits').innerHTML = hits.map(p => `<button class="chip" data-mspick="${esc(p.code)}">${esc(p.name)} <small>${esc(p.code)}</small></button>`).join('');
  };
  $('#msHits').onclick = e => {
    const b = e.target.closest('[data-mspick]'); if (!b) return;
    $('#msQ').value = ''; $('#msHits').innerHTML = ''; $('#msQ').blur();
    showCard(b.dataset.mspick);
  };
  // en captura: corre antes que el del escáner, así Esc con la cámara abierta solo cierra la cámara
  addEventListener('keydown', e => { if (e.key === 'Escape' && M && $('#coscan').hidden) closeTable(); }, true);
  document.addEventListener('visibilitychange', () => { if (M) keepAwake(); });
}
