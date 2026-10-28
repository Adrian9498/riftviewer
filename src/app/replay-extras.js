// Datos que el replay ya trae y se muestran solos: flechas de objetivo, mulligan, XP de leyenda,
// poder de las unidades (y total por jugador en cada campo), palabras clave y cartas ocultas.
import { arrowsKey, targetArrows } from '../replay/arrows';
import { $ } from './base';
import { cardByCode } from './cards';
import { PROJ, saveProj } from './clips';
import { relRect } from './notes';
import { BFZ, arr } from './replay';
import { floatText } from './script-engine';
import { app } from './state';
import { esc, hold } from './utils';

/* ---------- poder y palabras clave sobre cada carta ---------- */
export function mightOf(e) {
  const d = e._data, v = d?.m ?? d?.might;
  if (typeof v !== 'number' || !/unit/i.test(d?.type || e._card?.type || '')) return null;
  return v + mightBonus(e);
}
/* ---------- Estados de cartas ----------
   Del replay: temporaryMightBuff (poder extra) y whiteCounter (contador).
   Manuales (clic derecho): poder ±, daño y etiquetas, guardados en el proyecto por jugada:
   PROJ.cardMods[cardId] = [{i, might, dmg, tags}] y en cada jugada vale el último con i <= jugada actual. */
export function modAt(cardId, i = app.R?.i ?? 0) {
  const list = PROJ.cardMods?.[cardId]; if (!list) return null;
  let best = null; for (const m of list) if (m.i <= i && (!best || m.i >= best.i)) best = m;
  return best;
}
export function setMod(cardId, patch) {
  const i = app.R.i, list = ((PROJ.cardMods ||= {})[cardId] ||= []);
  const base = modAt(cardId, i) || { might: 0, dmg: 0, tags: [] };
  const next = { i, might: base.might, dmg: base.dmg, tags: [...base.tags], ...patch };
  const k = list.findIndex(m => m.i === i); if (k >= 0) list[k] = next; else list.push(next);
  saveProj();
}
export function clearMods(cardId) { const list = PROJ.cardMods?.[cardId]; if (!list) return; setMod(cardId, { might: 0, dmg: 0, tags: [] }); }
export const mightBonus = e => (e._card?.temporaryMightBuff || 0) + (modAt(e._cid)?.might || 0);
const keywordsOf = c => (Array.isArray(c?.keywords) ? c.keywords : c?.keywords ? [c.keywords] : []).filter(Boolean);
function badge(e, cls, text) {
  let b = e.querySelector(':scope > .' + cls);
  if (!text) { b?.remove(); return; }
  if (!b) { b = document.createElement('div'); b.className = cls; e.appendChild(b); }
  b.textContent = text;
}
/** Insignias de una carta según la zona donde está (se llama al pintarla). */
export function paintCardExtras(e, zone, back) {
  const c = e._card, onBoard = zone === 'base' || BFZ.includes(zone);
  e._zone = zone;
  const m = mightOf(e), bonus = mightBonus(e), mod = modAt(e._cid);
  badge(e, 'mt', onBoard && !back && m != null ? '⚔ ' + m : '');
  e.querySelector(':scope > .mt')?.classList.toggle('up', bonus > 0);
  e.querySelector(':scope > .mt')?.classList.toggle('down', bonus < 0);
  badge(e, 'dmg', onBoard && !back && mod?.dmg ? String(mod.dmg) : '');
  badge(e, 'ctr', onBoard && !back && c?.whiteCounter ? String(c.whiteCounter) : '');
  badge(e, 'tag', !back && mod?.tags?.length ? mod.tags.join(' · ') : '');
  const kws = keywordsOf(c);
  badge(e, 'kw', (onBoard || zone === 'legend') && !back && kws.length ? kws.slice(0, 2).join(' · ') + (kws.length > 2 ? ' +' + (kws.length - 2) : '') : '');
  e.classList.toggle('hid', !!c?.hidden);
}

/** Total de poder de cada jugador en cada campo (solo suma lo que se ve; no resuelve combates). */
export function paintFieldSums() {
  document.querySelectorAll('#rfields .grp').forEach(g => {
    let sum = 0, n = 0;
    g.querySelectorAll(':scope > .card:not(.back)').forEach(c => { const m = mightOf(c); if (m != null) { sum += m; n++; } });
    if (n) g.dataset.sum = sum; else delete g.dataset.sum;
  });
}

/* ---------- XP de la leyenda ---------- */
export function paintLegendXp(st, prev, anim) {
  for (const p of st.players) {
    const leg = arr(p.board?.legend)[0], e = leg && app.R.el.get(leg.id); if (!e) continue;
    const xp = p.board?.legendXp || 0;
    if (xp > 0) e.dataset.xp = xp; else delete e.dataset.xp;
    const before = prev?.players.find(q => q.id === p.id)?.board?.legendXp || 0;
    if (anim && prev && xp > before) floatText(e, `+${xp - before} XP`, '#7fd3ff');
  }
}

/* ---------- flechas de objetivo ---------- */
const svgLayer = () => $('#tarrows');
export function clearTargetArrows() { const l = svgLayer(); if (l) l.innerHTML = ''; }
/** Elementos a los que apuntan flechas nuevas (para que la cámara los encuadre), o null si no cambiaron. */
export function newArrowTargets(st, prev) {
  const now = targetArrows(st);
  if (!now.length || arrowsKey(now) === arrowsKey(prev ? targetArrows(prev) : [])) return null;
  const els = now.map(a => app.R.el.get(a.targetCardId)).filter(Boolean);
  return els.length ? els : null;
}
export function drawTargetArrows(st) {
  const layer = svgLayer(); if (!layer) return;
  const stage = $('#stage');
  layer.setAttribute('viewBox', `0 0 ${stage.offsetWidth} ${stage.offsetHeight}`);
  let svg = '';
  for (const a of targetArrows(st)) {
    const tgt = app.R.el.get(a.targetCardId); if (!tgt?.isConnected) continue;
    const src = app.R.el.get(a.sourceKey) || $('#rchain');
    if (!src?.isConnected) continue;
    const col = app.R.players.find(p => p.id === a.owner)?.col || '#f2c14e';
    const ra = relRect(src), rb = relRect(tgt);
    const x1 = ra.x + ra.w / 2, y1 = ra.y + ra.h / 2, x2 = rb.x + rb.w / 2, y2 = rb.y + rb.h / 2;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, cx = mx - (y2 - y1) * 0.18, cy = my + (x2 - x1) * 0.18;
    const tl = Math.hypot(x2 - cx, y2 - cy) || 1, ux = (x2 - cx) / tl, uy = (y2 - cy) / tl, L = 30, W = 17;
    svg += `<path pathLength="1" stroke="${col}" d="M${x1},${y1} Q${cx},${cy} ${x2 - ux * L * 0.6},${y2 - uy * L * 0.6}"/>`
      + `<polygon fill="${col}" points="${x2},${y2} ${x2 - ux * L - uy * W},${y2 - uy * L + ux * W} ${x2 - ux * L + uy * W},${y2 - uy * L - ux * W}"/>`
      + `<circle cx="${x2}" cy="${y2}" r="${Math.max(rb.w, rb.h) * 0.55}" fill="none" stroke="${col}" stroke-width="4" class="tring"/>`;
  }
  layer.innerHTML = svg;
}

/* ---------- mulligan ---------- */
function handVisible(pid) {
  const pol = $('#rhands').value;
  return pol === 'all' || (pol === 'view' && pid === app.R.view);
}
function mini(c, cls, show) {
  const d = show ? cardByCode(c.cardCode, c.name, c.imageUrl) : null;
  return `<div class="mc ${cls}${show ? '' : ' mback'}"${d ? ` style="background-image:url('${d.img}')"` : ''} title="${show ? esc(c.name) : ''}">${show && !d ? esc(c.name) : ''}</div>`;
}
/** Panel del mulligan: mano inicial de cada jugador y, cuando confirma, qué devolvió y qué robó. */
export function renderMulligan(i, anim) {
  const M = app.R.mull, box = $('#mullov');
  if (!M || i < M.start || i > M.end || (i === M.end && !anim)) { box.classList.remove('show'); return false; }
  box.innerHTML = `<h3>MULLIGAN</h3>` + app.R.players.map(p => {
    const pm = M.players[p.id]; if (!pm) return '';
    const done = i >= pm.doneAt, show = handVisible(p.id), ret = new Set(pm.returned);
    const status = !done ? 'eligiendo…' : pm.returned.length ? `devolvió ${pm.returned.length}` : 'se quedó con su mano';
    return `<div class="mrow" style="--pc:${p.col}"><div class="mname">${esc(p.name)}<small>${status}</small></div>
      <div class="mcards">${pm.initial.map(c => mini(c, done && ret.has(c.id) ? 'ret' : '', show)).join('')}
      ${done && pm.drawn.length ? `<span class="marrow">→</span>${pm.drawn.map(c => mini(c, 'new', show)).join('')}` : ''}</div></div>`;
  }).join('');
  box.classList.add('show');
  return true;
}
/** En la última jugada del mulligan, deja ver el resultado unos segundos y luego lo oculta. */
export async function finishMulligan(i) {
  const M = app.R.mull;
  if (!M || i !== M.end || !$('#mullov').classList.contains('show')) return;
  await hold(2600);
  $('#mullov').classList.remove('show');
}
