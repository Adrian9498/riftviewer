// Menú de clic derecho sobre la mesa.
// En una carta de un replay: poder ±, daño, etiquetas (desde la jugada actual en adelante) y su imagen.
// En guiones y campos de batalla: solo la imagen (los estados de un guion se escriben con "poder" y "daño").
import { $, ic, stage } from './base';
import { CUSTOM } from './cards';
import { pickImageFor, removeCustomImage } from './custom-images';
import { REC } from './export';
import { PICK } from './notes';
import { clearMods, mightOf, modAt, paintCardExtras, paintFieldSums, setMod } from './replay-extras';
import { posLabel } from './transport';
import { app } from './state';
import { esc } from './utils';

const TAGS = ['Aturdida', 'Buff', 'Protegida', 'Objetivo'];
let T = null;   // {el, key, name, cardId}

export function closeCardMenu() { const m = $('#cardmenu'); if (m) m.hidden = true; T = null; }

function render() {
  const m = $('#cardmenu'), mod = T.cardId ? modAt(T.cardId) : null, custom = CUSTOM.has(T.key);
  const states = T.cardId ? `
    <div class="cmh">${esc(T.name)}<small>Cambios desde ${esc(posLabel(app.R.i))}</small></div>
    <div class="cmrow"><span>Poder</span><button class="btn mini ico" data-cm="might:-1">−</button><b>${(mod?.might || 0) > 0 ? '+' : ''}${mod?.might || 0}</b><button class="btn mini ico" data-cm="might:1">+</button>${mightOf(T.el) != null ? `<small>= ⚔ ${mightOf(T.el)}</small>` : ''}</div>
    <div class="cmrow"><span>Daño</span><button class="btn mini ico" data-cm="dmg:-1">−</button><b>${mod?.dmg || 0}</b><button class="btn mini ico" data-cm="dmg:1">+</button></div>
    <div class="cmtags">${TAGS.map(t => `<button class="chip${mod?.tags?.includes(t) ? ' on' : ''}" data-tag="${t}">${t}</button>`).join('')}
      ${(mod?.tags || []).filter(t => !TAGS.includes(t)).map(t => `<button class="chip on" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}
      <button class="chip add" data-cm="tag">+ Otra</button></div>
    ${mod && (mod.might || mod.dmg || mod.tags.length) ? `<button class="cmi" data-cm="clear">${ic('x')} Quitar cambios de esta carta</button>` : ''}
    <div class="cmsep"></div>` : `<div class="cmh">${esc(T.name)}</div>`;
  m.innerHTML = states + `<button class="cmi" data-cm="img">${ic('upload')} ${custom ? 'Cambiar' : 'Poner'} imagen propia…</button>`
    + (custom ? `<button class="cmi" data-cm="rmimg">${ic('x')} Quitar imagen propia</button>` : '');
}
function place(x, y) {
  const m = $('#cardmenu'); m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px'; m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
}
function repaint() {
  if (T.el.isConnected) paintCardExtras(T.el, T.el._zone, T.el.classList.contains('back'));
  paintFieldSums(); render();
}

export function init() {
  stage.addEventListener('contextmenu', e => {
    if (REC.on || PICK) return;
    const t = e.target.closest('[data-ikey]'); if (!t) return; e.preventDefault();
    const card = t.closest('.card');
    T = { el: t, key: t.dataset.ikey, name: t.dataset.iname || 'esta carta', cardId: app.R && card?._cid ? card._cid : null };
    render(); place(e.clientX, e.clientY);
  });
  $('#cardmenu').addEventListener('click', e => {
    if (!T) return;
    const b = e.target.closest('button'); if (!b) return;
    const cm = b.dataset.cm, tag = b.dataset.tag, mod = T.cardId ? (modAt(T.cardId) || { might: 0, dmg: 0, tags: [] }) : null;
    if (cm?.startsWith('might:')) { setMod(T.cardId, { might: mod.might + +cm.slice(6) }); repaint(); return; }
    if (cm?.startsWith('dmg:')) { setMod(T.cardId, { dmg: Math.max(0, mod.dmg + +cm.slice(4)) }); repaint(); return; }
    if (tag) { setMod(T.cardId, { tags: mod.tags.includes(tag) ? mod.tags.filter(x => x !== tag) : [...mod.tags, tag] }); repaint(); return; }
    if (cm === 'tag') { const v = prompt('Etiqueta para esta carta (por ejemplo "Silenciada"):')?.trim(); if (v) { setMod(T.cardId, { tags: [...new Set([...mod.tags, v.slice(0, 24)])] }); repaint(); } return; }
    if (cm === 'clear') { clearMods(T.cardId); repaint(); return; }
    if (cm === 'img') { const k = T.key; closeCardMenu(); pickImageFor(k); return; }
    if (cm === 'rmimg') { const k = T.key, n = T.name; closeCardMenu(); removeCustomImage(k, n); }
  });
  document.addEventListener('pointerdown', e => { if (T && !e.target.closest('#cardmenu')) closeCardMenu(); }, true);
  document.addEventListener('keydown', e => { if (T && e.key === 'Escape') closeCardMenu(); });
  addEventListener('wheel', () => { if (T) closeCardMenu(); }, { passive: true });
  // al cambiar de jugada, los valores del menú ya no corresponden
  document.addEventListener('rb:pos', () => { if (T) closeCardMenu(); });
}
