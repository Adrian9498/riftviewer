// En la mesa: para partidas presenciales con cartas en otro idioma (por ejemplo chino contra inglés).
// - Eliges con qué mazo juegas y escaneas la leyenda del rival: ves tu récord contra ella y tus notas.
// - Escaneas la carta que jugó el rival (o escribes su número) y ves su nombre y su texto en inglés, en grande.
//   Las cartas vistas quedan en una tira para volver a leerlas sin escanear otra vez.
// - Al terminar, Gané / Perdí lo anota en el récord del mazo y contra esa leyenda.
// - Moneda, dado y reloj de ronda.
import { searchPrintings } from '../collection/model';
import { fullRecord, legendKey, legendName, legendParts, matchups } from '../deck/analysis';
import { cardTextHTML } from '../data/symbols';
import { norm } from '../data/text';
import { $, ic } from './base';
import { cardByCode, deckCatalog, printRank } from './cards';
import { catalog } from './collection';
import { openScanner, releaseScanner, warmScanner } from './scanner';
import { toast } from './shell';
import { esc } from './utils';
import * as DB from './decks';
import { renderDetail, renderLib } from './decklib';

const KEY = 'rb_mesa', FRESH = 6 * 3600 * 1000;   // una partida que quedó abierta hace más de 6 h ya no sirve
const TYPE_ES = { Unit: 'Unidad', Spell: 'Hechizo', Gear: 'Equipo', Legend: 'Leyenda', Battlefield: 'Campo de batalla', Rune: 'Runa', Token: 'Ficha' };
const ROUND_MIN = [30, 40, 50, 55, 60], WARN_MS = 5 * 60 * 1000;
/**
 * M: { deckId, opp: {code,name}|null, seen: códigos (el más nuevo primero), cur, ts,
 *      clock: { min, end: hora en que acaba si corre, left: ms que quedan si está en pausa, warned },
 *      last: la última partida anotada (para deshacer), roll: último volado o dado }
 */
let M = null;
let lock = null;   // pantalla siempre encendida mientras está abierta
let tick = 0;

const ls = (v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(KEY) || 'null'); localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { return null; } };
const save = () => { M.ts = Date.now(); ls(M); };
const pct = x => Math.round(x * 100) + '%';
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const newClock = (min = 50) => ({ min, end: null, left: min * 60000, warned: false });

/* ---------- el mazo con el que juegas ---------- */
/** El mazo guardado; si es el que está abierto en la página de mazos, ese mismo objeto (para no pisar cambios). */
function deckById(id) {
  if (!id) return null;
  const cur = DB.currentDeck();
  if (cur?.id === id && !DB.isShared()) return cur;
  return DB.allDecks().find(d => d.id === id) || null;
}
/** Vuelve a pintar la sección de mazos si está a la vista (cambió el récord). */
function refreshDecks() {
  const b = $('#deckb'); if (!b || b.hidden) return;
  if (b.dataset.view === 'detail' && DB.currentDeck()) renderDetail();
  else if (b.dataset.view === 'lib') renderLib();
}

/** Abre la mesa. deckId: el mazo con el que juegas (opcional; se puede elegir dentro). */
export function openTable(deckId = '') {
  const old = ls();
  M = old && Date.now() - (old.ts || 0) < FRESH && Array.isArray(old.seen) ? old : { seen: [], cur: null, opp: null };
  if (deckId) M.deckId = deckId;
  if (M.deckId && !deckById(M.deckId)) M.deckId = '';
  M.clock ||= newClock();
  save();
  $('#mesa').hidden = false; document.body.classList.add('inmesa');
  $('#msQ').value = ''; $('#msHits').innerHTML = '';
  render();
  clearInterval(tick); tick = setInterval(clockTick, 1000);
  warmScanner().catch(() => {});
  keepAwake();
}
export function closeTable() {
  if (!M) return;
  M = null; clearInterval(tick);
  $('#mesa').hidden = true; document.body.classList.remove('inmesa');
  lock?.release?.().catch?.(() => {}); lock = null;
  releaseScanner();
  refreshDecks();
}
async function keepAwake() {
  try { if (M && !lock && document.visibilityState === 'visible') { lock = await navigator.wakeLock?.request('screen'); lock?.addEventListener?.('release', () => { lock = null; }); } } catch (e) { lock = null; }
}

/* ---------- cartas del rival ---------- */
/** Una carta vista: va al principio de la tira y se muestra. */
export function showCard(code) {
  if (!M) return;
  M.seen = [code, ...M.seen.filter(c => c !== code)].slice(0, 40);
  M.cur = code; M.tab = 'cards'; save(); render();
  $('#msCard')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
}
function scan() {
  const cat = catalog(); if (!cat) { toast('Espera a que cargue el catálogo de cartas.'); return; }
  openScanner({ cat, lookup: true, pick: p => showCard(p.code) });
}

/* ---------- elegir tu mazo y la leyenda rival: una lista con imágenes, con buscador ---------- */
let P = null;   // { kind: 'deck'|'opp', items }
const short = n => legendParts(n)[0];
const recTxt = r => (r.w + r.l ? `${r.w}-${r.l}` : '');
function deckItems() {
  return DB.allDecks().sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0)).map(d => {
    const leg = d.legend && cardByCode(d.legend), r = fullRecord(d);
    return { id: d.id, img: leg?.img || '', name: d.name || 'Sin nombre', sub: leg ? short(leg.name) : 'Sin leyenda', badge: recTxt(r), fav: !!d.fav, q: norm(`${d.name} ${leg?.name || ''}`) };
  });
}
function legendItems() {
  const d = deckById(M.deckId), ms = d ? matchups(d.replays || [], d.games || []) : [];
  const vs = new Map(ms.map(m => [m.key, m]));
  // una sola entrada por leyenda: de sus impresiones (normal, arte alterno, firmada…) se queda la normal
  const one = new Map();
  for (const c of deckCatalog()) {
    if (c.type !== 'Legend') continue;
    const k = legendKey(c.code, c.name), o = one.get(k);
    if (!o || printRank(c) < printRank(o) || (printRank(c) === printRank(o) && c.name.length < o.name.length)) one.set(k, c);
  }
  return [...one].map(([k, c]) => {
    const m = vs.get(k), n = legendName(c.name), [who, title] = legendParts(n);
    return { id: c.code, img: c.img || '', name: who, sub: title, badge: m ? `${m.w}-${m.l}` : '', games: m ? m.w + m.l : 0, q: norm(n) };
  }).sort((a, b) => b.games - a.games || a.name.localeCompare(b.name) || a.sub.localeCompare(b.sub));
}
function openPick(kind) {
  P = { kind, items: kind === 'deck' ? deckItems() : legendItems() };
  const el = $('#msPick');
  el.innerHTML = `<div class="mspk" role="dialog" aria-modal="true" aria-labelledby="mspkT">
    <header><h2 id="mspkT">${kind === 'deck' ? '¿Con qué mazo juegas?' : '¿Contra qué leyenda juegas?'}</h2><button class="btn ico" data-mspclose aria-label="Cerrar">${ic('x')}</button></header>
    <input type="search" id="mspQ" placeholder="${kind === 'deck' ? 'Buscar mazo o leyenda' : 'Buscar leyenda (Jinx, Ahri…)'}" autocomplete="off">
    <div class="mspgrid" id="mspGrid"></div>
    ${kind === 'deck' && M.deckId ? '<button class="btn ghost mspnone" data-mspi="">Jugar sin mazo</button>' : ''}
    ${kind === 'opp' && M.opp ? '<button class="btn ghost mspnone" data-mspi="">Quitar la leyenda rival</button>' : ''}
  </div>`;
  el.hidden = false;
  pickList('');
  if (window.matchMedia?.('(hover: hover)')?.matches) $('#mspQ').focus();
}
function pickList(q) {
  const s = norm(q.trim()), cur = P.kind === 'deck' ? M.deckId : M.opp?.code;
  const list = P.items.filter(x => !s || x.q.includes(s));
  $('#mspGrid').innerHTML = list.length ? list.map(x => `<button class="mspi${x.id === cur ? ' on' : ''}" data-mspi="${esc(x.id)}">
      <span class="mspimg"${x.img ? ` style="background-image:url('${esc(x.img)}')"` : ''}>${x.img ? '' : ic('cards')}${x.fav ? `<i class="mspfav">${ic('star')}</i>` : ''}</span>
      <b>${esc(x.name)}</b><small>${esc(x.sub)}</small>${x.badge ? `<em>${P.kind === 'opp' ? 'contra ella ' : ''}${x.badge}</em>` : ''}</button>`).join('')
    : `<p class="dlhint">${P.items.length ? 'Nada coincide con la búsqueda.' : P.kind === 'deck' ? 'Todavía no tienes mazos. Créalos en la sección Mazos.' : 'Las cartas todavía se están cargando.'}</p>`;
}
/** Empezar de cero en la mesa. Las partidas ya anotadas en los mazos no se tocan. */
function askReset() {
  P = { kind: 'reset', items: [] };
  const el = $('#msPick');
  el.innerHTML = `<div class="mspk msask" role="alertdialog" aria-modal="true" aria-labelledby="mspkT" aria-describedby="mspkD">
    <header><h2 id="mspkT">¿Reiniciar todo?</h2><button class="btn ico" data-mspclose aria-label="Cerrar">${ic('x')}</button></header>
    <p id="mspkD">Se quitan el mazo y la leyenda rival elegidos, las cartas escaneadas, el reloj, la moneda y el dado. Las partidas que ya anotaste en tus mazos se quedan.</p>
    <div class="msaskb"><button class="btn" data-mspclose>Cancelar</button><button class="btn primary" data-msresetok>${ic('replay')} Reiniciar todo</button></div>
  </div>`;
  el.hidden = false;
  el.querySelector('[data-msresetok]').focus();
}
export function resetTable() {
  if (!M) return;
  M = { seen: [], cur: null, opp: null, deckId: '', tab: 'game', clock: newClock(M.clock?.min || 50) };
  save(); closePick(); render();
  $('#msQ').value = ''; $('#msHits').innerHTML = '';
  toast('Mesa reiniciada', 'ok');
}
function closePick() { P = null; const el = $('#msPick'); el.hidden = true; el.innerHTML = ''; }
function picked(id) {
  if (P.kind === 'deck') { M.deckId = id; M.last = null; }
  else M.opp = id ? { code: id, name: legendName(deckCatalog().find(c => c.code === id)?.name || info(id).name) } : null;
  closePick(); save(); render();
}
/** Lo que se sabe de la carta: el catálogo de impresiones (nombre, imagen) y el de Riftcodex (texto, energía, poder). */
function info(code) {
  const p = catalog()?.byCode.get(code), d = cardByCode(code, p?.name) || {};
  return { code, name: p?.name || d.name || code, img: p?.img || d.img || '', type: d.type || p?.type || '', e: d.e, m: d.m ?? d.might, text: d.text, rich: d.rich };
}

/* ---------- resultado ---------- */
function vsLegend(d, code) {
  if (!d || !code) return null;
  return matchups(d.replays || [], d.games || []).find(m => m.key === legendKey(code, M.opp?.name || info(code).name)) || null;
}
function record(result) {
  const d = deckById(M.deckId);
  if (!d) { toast('Primero elige con qué mazo jugaste.'); openPick('deck'); return; }
  const g = { id: newId(), ts: Date.now(), result, opp: M.opp ? { legendCode: M.opp.code, legendName: M.opp.name } : null, seen: [...M.seen] };
  (d.games ||= []).push(g);
  DB.writeDeck(d);
  M.last = { deckId: d.id, id: g.id, result };
  // la siguiente partida (al mejor de tres) suele ser contra el mismo rival: la leyenda se queda
  M.seen = []; M.cur = null; save(); render(); refreshDecks();
  navigator.vibrate?.(40);
}
function undo() {
  const l = M.last; if (!l) return;
  const d = deckById(l.deckId);
  if (d?.games) { d.games = d.games.filter(g => g.id !== l.id); DB.writeDeck(d); }
  M.last = null; save(); render(); refreshDecks();
  toast('Se quitó la última partida anotada');
}

/* ---------- moneda, dado y reloj de ronda ---------- */
const calm = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
const anim = (el, frames, opts) => (typeof el?.animate === 'function' && !calm() ? el.animate(frames, opts).finished.catch(() => {}) : Promise.resolve());
/** Volado: la moneda sube girando y cae del lado que salió. */
function flip() {
  const v = Math.random() < 0.5 ? 'Cara' : 'Cruz';
  M.roll = { kind: 'coin', v }; save(); renderTools(); rolling();
  const coin = $('#msTools .mscoin-in'), end = `rotateX(${1800 + (v === 'Cruz' ? 180 : 0)}deg)`;
  coin.style.transform = end;
  anim($('#msTools .mscoin'), [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-70px) scale(1.25)', offset: 0.45 }, { transform: 'translateY(0) scale(1)' }],
    { duration: 1100, easing: 'cubic-bezier(.3,.7,.4,1)' });
  anim(coin, [{ transform: 'rotateX(0deg)' }, { transform: end }], { duration: 1100, easing: 'cubic-bezier(.2,.6,.3,1)' }).then(() => land());
}
/** d20: rueda dando vueltas, los números pasan rápido y se detiene en el que salió. */
function die() {
  const v = 1 + Math.floor(Math.random() * 20);
  M.roll = { kind: 'd20', v: String(v) }; save(); renderTools(); rolling();
  const box = $('#msTools .msd20'), num = box?.querySelector('b');
  if (num && !calm()) {
    box.classList.add('rolling');
    let k = 0; const t = setInterval(() => { num.textContent = String(1 + Math.floor(Math.random() * 20)); if (++k > 14) { clearInterval(t); num.textContent = String(v); } }, 55);
  }
  anim(box, [{ transform: 'translate(-40px,-50px) rotate(-260deg) scale(.6)' }, { transform: 'translate(8px,6px) rotate(25deg) scale(1.08)', offset: 0.7 },
    { transform: 'translate(-3px,0) rotate(-8deg) scale(.97)', offset: 0.85 }, { transform: 'none' }], { duration: 950, easing: 'cubic-bezier(.25,.8,.35,1)' })
    .then(() => { if (num) num.textContent = String(v); box?.classList.remove('rolling'); land(); });
}
/** Mientras gira, el resultado escrito no se ve todavía. */
const rolling = () => { if (!calm()) $('#msTools .msroll')?.classList.remove('done'); };
/** Al caer: el resultado se anuncia y un pequeño golpe. */
function land() {
  const o = $('#msTools .msroll'); if (!o) return;
  o.classList.add('done'); navigator.vibrate?.(25);
}
const D20 = '<svg viewBox="0 0 100 100" aria-hidden="true"><polygon class="o" points="50,3 91,27 91,73 50,97 9,73 9,27"/><polygon class="t" points="50,22 78,68 22,68"/>'
  + '<path class="l" d="M50,3 50,22 M91,27 78,68 M91,27 50,22 M9,27 50,22 M9,27 22,68 M91,73 78,68 M9,73 22,68 M50,97 78,68 M50,97 22,68"/></svg>';
function rollHTML(r) {
  if (!r) return '<div class="msstage"><small>¿Quién empieza?</small></div>';
  if (r.kind === 'coin') return `<div class="msstage"><div class="mscoin" aria-hidden="true"><div class="mscoin-in" style="transform:rotateX(${r.v === 'Cruz' ? 180 : 0}deg)">
      <span class="f">${ic('crown')}<i>Cara</i></span><span class="b">${ic('star')}<i>Cruz</i></span></div></div>
    <output class="msroll done" aria-live="polite"><b>${esc(r.v)}</b><small>volado</small></output></div>`;
  const n = +r.v;
  return `<div class="msstage"><div class="msd20${n === 20 ? ' crit' : n === 1 ? ' fail' : ''}" aria-hidden="true">${D20}<b>${n}</b></div>
    <output class="msroll done" aria-live="polite"><b>${n}</b><small>${n === 20 ? '¡crítico!' : n === 1 ? 'pifia' : 'd20'}</small></output></div>`;
}
const clockLeft = c => c.end ? Math.max(0, c.end - Date.now()) : c.left;
function clockToggle() {
  const c = M.clock;
  if (c.end) { c.left = clockLeft(c); c.end = null; }
  else { if (c.left <= 0) Object.assign(c, newClock(c.min)); c.end = Date.now() + c.left; }
  save(); renderTools(); renderChips();
}
function clockReset(min = M.clock.min) { M.clock = newClock(min); save(); renderTools(); renderChips(); }
function clockTick() {
  if (!M?.clock?.end) return;
  const c = M.clock, left = clockLeft(c);
  if (!c.warned && left <= WARN_MS) { c.warned = true; save(); navigator.vibrate?.([200, 100, 200]); toast('Quedan 5 minutos de ronda'); }
  if (left <= 0) { c.left = 0; c.end = null; save(); navigator.vibrate?.([400, 150, 400, 150, 400]); toast('Se acabó el tiempo de la ronda'); }
  const el = $('#msClockT'); if (el) { el.textContent = fmt(left); el.classList.toggle('warn', left <= WARN_MS); }
  const mini = $('#msClockMini'); if (mini) { mini.textContent = fmt(left); mini.parentElement.classList.toggle('warn', left <= WARN_MS); }
  if (!c.end) { renderTools(); renderChips(); }
}
const fmt = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/* ---------- pestañas y la barra de arriba ---------- */
const TABS = ['game', 'cards', 'tools'];
export function showTab(t) {
  if (!M || !TABS.includes(t)) return;
  M.tab = t; save(); renderTabs();
  $('#mesa .msbody').scrollTop = 0;
}
function renderTabs() {
  const on = TABS.includes(M.tab) ? M.tab : 'game';
  for (const b of document.querySelectorAll('#mesa .mstabs [data-mstab]')) { const sel = b.dataset.mstab === on; b.classList.toggle('on', sel); b.setAttribute('aria-selected', String(sel)); b.tabIndex = sel ? 0 : -1; }
  for (const p of document.querySelectorAll('#mesa .mspan')) p.hidden = p.id !== 'msp-' + on;
  $('#msSeenN').textContent = M.seen.length ? String(M.seen.length) : '';
}
/** Siempre a la vista, en cualquier pestaña: la leyenda rival y el reloj (si se está usando). Tocarlos lleva a su pestaña. */
function renderChips() {
  const c = M.clock, left = clockLeft(c), used = c.end || left < c.min * 60000;
  const opp = M.opp ? info(M.opp.code) : null;
  $('#msChips').innerHTML = (opp ? `<button class="mschip" data-mstab="game" title="Leyenda rival: ${esc(opp.name)}"><img src="${esc(opp.img)}" alt=""><span>${esc(short(opp.name))}</span></button>` : '')
    + (used ? `<button class="mschip clock${left <= WARN_MS ? ' warn' : ''}${c.end ? '' : ' paused'}" data-mstab="tools" title="Reloj de ronda">${ic(c.end ? 'play' : 'pause')}<span id="msClockMini">${fmt(left)}</span></button>` : '');
}

/* ---------- pintar ---------- */
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
function gameHTML() {
  const d = deckById(M.deckId);
  // dos tarjetas iguales: tú y tu rival; tocarlas abre la lista para elegir
  const slot = (attr, label, img, title, sub, empty, emptySub) => title
    ? `<button class="msslot" ${attr}><span class="mspimg"${img ? ` style="background-image:url('${esc(img)}')"` : ''}>${img ? '' : ic('cards')}</span>
        <span class="mssl"><small>${label}</small><b>${esc(title)}</b><em>${sub}</em></span><span class="mschg">Cambiar</span></button>`
    : `<button class="msslot none" ${attr}><span class="mspimg">${ic('plus')}</span><span class="mssl"><small>${label}</small><b>${empty}</b><em>${emptySub}</em></span></button>`;
  const leg = d?.legend && cardByCode(d.legend), r = d && fullRecord(d);
  const mine = slot('data-mspickdeck', 'Tu mazo', leg?.img, d && (d.name || 'Sin nombre'),
    d ? `${esc(leg ? short(leg.name) : 'Sin leyenda')}${r.w + r.l ? ` · <b>${r.w}-${r.l}</b>` : ''}` : '', 'Elige tu mazo', 'Para anotar el resultado en su récord');
  const oc = M.opp && info(M.opp.code), m = M.opp && vsLegend(d, M.opp.code), g = m ? m.w + m.l : 0;
  const opp = slot('data-mspickopp', 'Leyenda rival', oc?.img, M.opp && short(M.opp.name),
    M.opp ? (!d ? 'Elige tu mazo para ver tu récord' : g ? `Contra ella: <b>${m.w}-${m.l}</b> · ${pct(m.w / g)}` : 'Primera vez con este mazo') : '',
    'Elige su leyenda', 'Para ver tu récord contra ella');
  const sel = `<div class="msvs">${mine}<span class="msvsx">VS</span>${opp}</div>`;
  const notes = d?.notes ? `<details class="msnotes"><summary>${ic('note')} Tus notas del mazo</summary><p>${esc(d.notes)}</p></details>` : '';
  const last = M.last && M.last.deckId === M.deckId
    ? `<div class="mslast ${M.last.result}">${ic(M.last.result === 'w' ? 'trophy' : 'x')}<span>Anotada: <b>${M.last.result === 'w' ? 'victoria' : 'derrota'}</b>${d ? ` · el mazo va ${fullRecord(d).w}-${fullRecord(d).l}` : ''}</span><button class="btn mini" data-msundo>Deshacer</button></div>` : '';
  return [`${sel}${notes}`, `<h3 class="msh">¿Cómo terminó?</h3><div class="msres"><button class="btn msw" data-msres="w">${ic('trophy')} Gané</button><button class="btn msl" data-msres="l">${ic('x')} Perdí</button></div>${last}`];
}
function renderTools() {
  if (!M) return;
  const c = M.clock, left = clockLeft(c), r = M.roll;
  $('#msTools').innerHTML = `
    <div class="mstool">
      <div class="msrollb"><button class="btn" data-mscoin>${ic('crown')} Lanzar moneda</button><button class="btn" data-msdie>${ic('sparkle')} Tirar d20</button></div>
      ${rollHTML(r && r.kind !== 'die' ? r : null)}
    </div>
    <div class="mstool msclock">
      <span class="msclockt${left <= WARN_MS ? ' warn' : ''}" id="msClockT">${fmt(left)}</span>
      <button class="btn${c.end ? '' : ' primary'}" data-msclock>${ic(c.end ? 'pause' : 'play')} ${c.end ? 'Pausar' : left < c.min * 60000 && left > 0 ? 'Seguir' : 'Iniciar ronda'}</button>
      <button class="btn ico" data-msclockreset title="Reiniciar el reloj" aria-label="Reiniciar el reloj">${ic('replay')}</button>
      <select id="msMin" aria-label="Minutos de la ronda">${ROUND_MIN.map(n => `<option value="${n}"${n === c.min ? ' selected' : ''}>${n} min</option>`).join('')}</select>
    </div>`;
}
function render() {
  if (!M) return;
  const d = deckById(M.deckId);
  $('#msDeck').textContent = d ? `Jugando con ${d.name || 'Sin nombre'}` : 'Partida presencial';
  renderTabs(); renderChips();
  [$('#msGame').innerHTML, $('#msEnd').innerHTML] = gameHTML();
  renderTools();
  const cur = M.cur && M.seen.includes(M.cur) ? M.cur : null;
  $('#msView').innerHTML = cur ? cardHTML(cur)
    : `<div class="msempty">${ic('camera')}<b>Escanea la carta que jugó tu rival</b><span>Funciona con cartas en chino, inglés u otro idioma: ves su nombre y su texto en inglés. Apunta al número de abajo de la carta.</span></div>`;
  $('#msSeen').innerHTML = M.seen.length ? `<div class="mshead"><h3>Cartas del rival en esta partida <small>${M.seen.length}</small></h3><button class="btn mini" data-msnew>${ic('x')} Limpiar</button></div>
    <div class="msstrip">${M.seen.map(code => { const c = info(code); return `<button class="msth${code === cur ? ' on' : ''}" data-mscard="${esc(code)}" title="${esc(c.name)}"><img src="${esc(c.img)}" alt="${esc(c.name)}" loading="lazy"><span>${esc(c.name)}</span></button>`; }).join('')}</div>` : '';
}

export function init() {
  $('#hMesa').onclick = () => openTable();
  $('#msClose').onclick = closeTable;
  $('#msScan').onclick = () => scan();
  $('#mesa').addEventListener('click', e => {
    if (!M) return;
    const tb = e.target.closest('[data-mstab]'); if (tb) { showTab(tb.dataset.mstab); return; }
    const t = e.target.closest('[data-mscard]'); if (t) { showCard(t.dataset.mscard); return; }
    if (e.target.closest('#msReset')) { askReset(); return; }
    if (e.target.closest('[data-msresetok]')) { resetTable(); return; }
    if (e.target.closest('[data-mspickdeck]')) { openPick('deck'); return; }
    if (e.target.closest('[data-mspickopp]')) { openPick('opp'); return; }
    if (e.target.closest('[data-mspclose]') || e.target.id === 'msPick') { closePick(); return; }
    const pi = e.target.closest('[data-mspi]'); if (pi && P) { picked(pi.dataset.mspi); return; }
    const res = e.target.closest('[data-msres]'); if (res) { record(res.dataset.msres); return; }
    if (e.target.closest('[data-msundo]')) { undo(); return; }
    if (e.target.closest('[data-msnew]')) { M.seen = []; M.cur = null; save(); render(); return; }
    if (e.target.closest('[data-mscoin]')) { flip(); return; }
    if (e.target.closest('[data-msdie]')) { die(); return; }
    if (e.target.closest('[data-msclock]')) { clockToggle(); return; }
    if (e.target.closest('[data-msclockreset]')) clockReset();
  });
  $('#mesa').addEventListener('change', e => {
    if (!M) return;
    if (e.target.id === 'msMin') clockReset(+e.target.value);
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
  addEventListener('keydown', e => { if (e.key === 'Escape' && M && $('#coscan').hidden) { if (P) closePick(); else closeTable(); } }, true);
  $('#mesa').addEventListener('input', e => { if (e.target.id === 'mspQ' && P) pickList(e.target.value); });
  document.addEventListener('visibilitychange', () => { if (M) { keepAwake(); clockTick(); } });
  // flechas entre las pestañas
  $('#mesa .mstabs').addEventListener('keydown', e => {
    if (!M || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    const i = TABS.indexOf(M.tab || 'game'), n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    e.preventDefault(); showTab(n); $(`#mstab-${n}`).focus();
  });
}
