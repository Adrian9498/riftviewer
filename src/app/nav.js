// Navegación entre las secciones: Inicio, Partida, Mazos y Colección.
// - Un menú desplegable ("◆ Riftviewer ▾") en la barra de cada sección.
// - Cada sección tiene su dirección (#/inicio, #/partida, #/mazos, #/coleccion): funcionan "atrás", recargar y los enlaces.
//   La dirección se mantiene al día sola, también cuando se cambia de sección por otros botones (tarjetas del inicio, recientes…).
import { $, ic } from './base';
import { hideCollection, showCollection } from './collection';
import { hideDecks, showDecks } from './decks';
import { DOC, hideHome, showHome } from './shell';
import { esc } from './utils';

export const ROUTES = ['inicio', 'partida', 'mazos', 'coleccion'];
const ITEMS = [
  { r: 'inicio', icon: 'home', label: 'Inicio', sub: () => 'Abrir un replay o un guion, y tus recientes' },
  { r: 'partida', icon: 'replay', label: 'Partida', sub: () => DOC.kind ? `${DOC.kind === 'replay' ? 'Replay' : 'Guion'} · ${DOC.name}` : 'Abre un replay o un guion primero' },
  { r: 'mazos', icon: 'cards', label: 'Mazos', sub: () => 'Construye, revisa y comparte tus mazos' },
  { r: 'coleccion', icon: 'binder', label: 'Colección', sub: () => 'Tus cartas, el escáner y su valor' },
];

/** La sección que se ve ahora. */
export function current() {
  if ($('#home').classList.contains('show')) return 'inicio';
  if (!$('#collb').hidden) return 'coleccion';
  if (!$('#deckb').hidden) return 'mazos';
  return DOC.kind ? 'partida' : 'inicio';
}
const routeOfHash = () => { const m = location.hash.match(/^#\/([a-z]+)/); return m && ROUTES.includes(m[1]) ? m[1] : null; };

/** Va a una sección. Sin partida abierta, "partida" lleva al inicio. */
export function go(route) {
  if (route === 'partida' && !DOC.kind) route = 'inicio';
  closeMenu();
  if (route === current() && route !== 'inicio') return;
  if (route === 'inicio') { hideDecks(); hideCollection(); showHome(); }
  else if (route === 'partida') { hideDecks(); hideCollection(); hideHome(); }
  else if (route === 'mazos') { hideCollection(); showDecks(); }
  else if (route === 'coleccion') { hideDecks(); showCollection(); }
}

/* ---------- la dirección sigue a la sección que se ve ---------- */
let syncing = false;
function syncHash() {
  if (syncing) return;
  const r = current(), want = '#/' + r;
  if (location.hash === want) return;
  if (/^#deck=/.test(location.hash)) return;   // un mazo compartido todavía no se ha abierto
  history.pushState(null, '', location.pathname + location.search + want);
}
function onHistory() {
  const r = routeOfHash() || 'inicio';
  syncing = true;
  try { go(r); } finally { syncing = false; }
  // si la sección pedida no existe ya (una partida que se cerró al recargar), se corrige la dirección sin agregar al historial
  const now = current();
  if (now !== r) history.replaceState(null, '', location.pathname + location.search + '#/' + now);
}

/* ---------- menú ---------- */
let opener = null;
function menuHTML() {
  const cur = current(), acct = $('#bAccount');
  return ITEMS.map(it => {
    const off = it.r === 'partida' && !DOC.kind, on = it.r === cur;
    return `<button role="menuitem" class="navit${on ? ' on' : ''}" data-go="${it.r}"${off ? ' disabled' : ''}${on ? ' aria-current="page"' : ''}>
      ${ic(it.icon)}<span><b>${it.label}</b><small>${esc(it.sub())}</small></span>${on ? ic('check') : ''}</button>`;
  }).join('')
    + (acct && !acct.hidden ? `<div class="navsep"></div><button role="menuitem" class="navit" data-acct>${ic('user')}<span><b>${esc(acct.textContent.trim() || 'Tu cuenta')}</b><small>Cuenta y sincronización</small></span></button>` : '');
}
export function openMenu(btn) {
  const m = $('#navmenu');
  if (!m.hidden && opener === btn) { closeMenu(); return; }
  opener = btn; m.innerHTML = menuHTML(); m.hidden = false;
  const r = btn.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = (r.bottom + 6) + 'px';
  btn.setAttribute('aria-expanded', 'true');
  (m.querySelector('.navit.on') || m.querySelector('.navit:not([disabled])'))?.focus();
}
export function closeMenu() {
  const m = $('#navmenu'); if (!m || m.hidden) return;
  m.hidden = true; opener?.setAttribute('aria-expanded', 'false');
}

export function init() {
  const m = document.createElement('div');
  m.id = 'navmenu'; m.className = 'navmenu'; m.setAttribute('role', 'menu'); m.hidden = true;
  document.body.appendChild(m);
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-nav]');
    if (b) { openMenu(b); return; }
    if (!m.hidden && !e.target.closest('#navmenu')) closeMenu();
  });
  m.addEventListener('click', e => {
    const it = e.target.closest('[data-go]'); if (it && !it.disabled) { go(it.dataset.go); opener?.focus(); return; }
    if (e.target.closest('[data-acct]')) { closeMenu(); $('#bAccount').click(); }
  });
  m.addEventListener('keydown', e => {
    const items = [...m.querySelectorAll('.navit:not([disabled])')], i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); opener?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Tab') closeMenu();
  });
  addEventListener('resize', closeMenu);

  // la dirección sigue a la sección, la cambie quien la cambie
  const obs = new MutationObserver(() => syncHash());
  obs.observe($('#home'), { attributes: true, attributeFilter: ['class'] });
  obs.observe($('#deckb'), { attributes: true, attributeFilter: ['hidden'] });
  obs.observe($('#collb'), { attributes: true, attributeFilter: ['hidden'] });
  addEventListener('popstate', onHistory);

  // al cargar: abrir la sección de la dirección (#/mazos, #/coleccion…)
  const r = routeOfHash();
  if (r) onHistory();
  else if (!/^#deck=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search + '#/' + current());
}
