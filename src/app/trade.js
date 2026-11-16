// Intercambios: lo que te sobra y lo que buscas, para compartir en el grupo de tu tienda.
// - "Me sobra": de tu colección, lo que pasa de 3 copias por carta (1 en leyendas y campos de batalla).
// - "Busco": lo que te falta para tus mazos, más lo que agregues a mano.
// - Se comparte con un enlace (la lista va dentro, sin servidor) y un texto para WhatsApp.
// - Al abrir el enlace de alguien más, la app cruza su lista con la tuya: qué te puede dar y qué le puedes dar.
import { FINISH_ES, searchPrintings } from '../collection/model';
import { decodeTrade, encodeTrade, extras, matchLists, tradeText, wants } from '../collection/trade';
import { money, priceOf, pricesNow } from '../cloud/prices';
import { norm } from '../data/text';
import { $, ic } from './base';
import { catalog, collection, deckNeedsFor, nameKey } from './collection';
import { toast } from './shell';
import { esc } from './utils';
import * as DB from './decks';

const KEY = 'rb_trade';
const MAX_PEERS = 12;
// ajustes de tus listas y las listas de otros que abriste (en este dispositivo)
let S = null;      // { name, exHave: [], exWant: [], add: { key: {code,n} }, peers: [{ id, name, data, ts }] }
let V = null;      // vista: { tab: 'have'|'want'|'peers', peer: id|null }

const load = () => { try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; } S = { name: '', exHave: [], exWant: [], add: {}, peers: [], ...(S || {}) }; };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

/* ---------- datos ---------- */
const print = code => catalog()?.byCode.get(code);
const keyOfCode = code => nameKey(print(code)?.name || code);
const nameOf = code => print(code)?.name || code;
/** Nombre para mostrar de una clave de carta (las claves van en minúsculas y sin signos). */
let KN = null;
const nameOfKey = k => { const cat = catalog(); if (!cat) return k; if (!KN || KN.cat !== cat) { KN = { cat, m: new Map() }; for (const p of cat.prints) { const nk = nameKey(p.name); if (!KN.m.has(nk)) KN.m.set(nk, p.name); } } return KN.m.get(k) || k; };
const priceFor = (code, finish = 'normal') => { const d = pricesNow(); return d ? priceOf(d, code, finish) ?? priceOf(d, code, finish === 'normal' ? 'foil' : 'normal') : null; };

/** Lo que te sobra, con su nombre y precio. */
function myHave() {
  const cat = catalog(); if (!cat) return [];
  return extras(collection(), cat.byCode, p => nameKey(p.name), new Set(S.exHave))
    .map(x => ({ ...x, key: keyOfCode(x.code), price: priceFor(x.code, x.finish) }))
    .sort((a, b) => (b.price ?? -1) - (a.price ?? -1) || nameOf(a.code).localeCompare(nameOf(b.code)));
}
/** Lo que te falta para tus mazos: de cada carta, las copias del mazo que más usa, menos las que tienes. */
function deckMissing() {
  const by = new Map();
  for (const d of DB.allDecks()) {
    const per = new Map();
    const add = (code, n) => { if (!code || !n) return; const p = print(code), k = keyOfCode(code); if (p && (p.type === 'Rune' || p.token)) return; per.set(k, { code, name: p?.name || code, n: (per.get(k)?.n || 0) + n }); };
    add(d.legend, 1); add(d.champion, 1);
    for (const [c, n] of Object.entries(d.main || {})) add(c, n);
    for (const [c, n] of Object.entries(d.side || {})) add(c, n);
    for (const c of d.battlefields || []) add(c, 1);
    for (const [k, x] of per) { const o = by.get(k); if (!o || x.n > o.n) by.set(k, { ...x, n: Math.min(3, x.n) }); }
  }
  return deckNeedsFor([...by.values()]).filter(x => x.miss > 0).map(x => ({ key: keyOfCode(x.code), code: x.code, n: x.miss, price: x.price }));
}
function myWant() {
  const miss = deckMissing(), price = new Map(miss.map(m => [m.key, m.price]));
  return wants(miss, S.add, new Set(S.exWant)).map(x => ({ ...x, price: price.get(x.key) ?? priceFor(x.code) }))
    .sort((a, b) => (b.price ?? -1) - (a.price ?? -1) || nameOf(a.code).localeCompare(nameOf(b.code)));
}
const myList = () => ({ name: S.name, have: myHave().map(({ code, finish, n }) => ({ code, finish, n })), want: myWant().map(({ code, n }) => ({ code, n })) });
const shareUrl = () => `${location.origin}${location.pathname}#trade=${encodeTrade(myList())}`;
const total = xs => xs.reduce((a, x) => a + (x.price ?? 0) * x.n, 0);

/* ---------- abrir y cerrar ---------- */
export function openTrade(tab = 'have') {
  load();
  V = { tab, peer: null };
  $('#trade').hidden = false; document.body.classList.add('intrade');
  render();
}
export function closeTrade() {
  V = null; closeSheet();
  $('#trade').hidden = true; document.body.classList.remove('intrade');
}
/** Abre la lista de otra persona (de un enlace) y la guarda para volver a verla. */
export function openPeer(code) {
  const t = decodeTrade(code); if (!t) { toast('Ese enlace de intercambio no se pudo leer.', 'err'); return false; }
  load();
  const id = code.slice(0, 24) + code.length;
  S.peers = [{ id, name: t.name || 'Sin nombre', data: code, ts: Date.now() }, ...S.peers.filter(p => p.id !== id && p.name !== (t.name || 'Sin nombre'))].slice(0, MAX_PEERS);
  save();
  if (!V) openTrade('peers');
  V.tab = 'peers'; V.peer = id; render();
  return true;
}

/* ---------- pintar ---------- */
function tile(x, attrs, extra = '') {
  const p = print(x.code), fin = x.finish && x.finish !== 'normal' ? `<i class="trfin">${esc(FINISH_ES[x.finish] || x.finish)}</i>` : '';
  return `<button class="trc" ${attrs} title="${esc(nameOf(x.code))}">
    <span class="trimg"${p?.img ? ` style="background-image:url('${esc(p.img)}')"` : ''}>${fin}<b>×${x.n}</b></span>
    <span class="trn">${esc(nameOf(x.code))}</span>
    <small>${x.price != null ? money(x.price) : '—'}${p && p.variant !== 'Normal' ? ` · ${esc(p.variant)}` : ''}</small>${extra}</button>`;
}
const sum = xs => `${xs.reduce((a, x) => a + x.n, 0)} cartas${total(xs) ? ` · ~${money(total(xs))}` : ''}`;
const hint = t => `<p class="dlhint">${t}</p>`;

function haveHTML() {
  const xs = myHave(), ex = S.exHave;
  if (!catalog()) return hint('Cargando el catálogo de cartas…');
  return `${hint('De cada carta te quedas 3 copias (1 de leyendas y campos de batalla) y el resto se ofrece; primero te quedas las versiones especiales. Toca una carta si no la quieres cambiar.')}
    <div class="trsum">${sum(xs)}</div>
    ${xs.length ? `<div class="trgrid">${xs.map(x => tile(x, `data-trexh="${esc(x.key)}"`)).join('')}</div>`
      : hint(Object.keys(collection().items).length ? 'No tienes copias de más. Cuando tengas más de 3 de una carta aparecerán aquí.' : 'Escanea o agrega tus cartas en la colección y aquí verás las que te sobran.')}
    ${ex.length ? `<h3 class="trh">No las cambio <small>${ex.length}</small></h3><div class="trchips">${ex.map(k => `<button class="chip" data-trinh="${esc(k)}">${ic('x')} ${esc(nameOfKey(k))}</button>`).join('')}</div>` : ''}`;
}
function wantHTML() {
  const xs = myWant(), ex = S.exWant;
  if (!catalog()) return hint('Cargando el catálogo de cartas…');
  return `${hint('Lo que te falta para tus mazos (cualquier versión sirve), más lo que agregues. Toca una carta para quitarla.')}
    <div class="trman"><input type="search" id="trQ" placeholder="Agregar una carta que buscas (nombre o número)" autocomplete="off"><div id="trHits"></div></div>
    <div class="trsum">${sum(xs)}</div>
    ${xs.length ? `<div class="trgrid">${xs.map(x => tile(x, `data-trexw="${esc(x.key)}"`, x.manual ? '<em class="trtag">agregada</em>' : '')).join('')}</div>`
      : hint(DB.allDecks().length ? 'Tienes todas las cartas de tus mazos.' : 'Arma tus mazos y aquí verás las cartas que te faltan, o agrégalas a mano.')}
    ${ex.length ? `<h3 class="trh">Ya no las busco <small>${ex.length}</small></h3><div class="trchips">${ex.map(k => `<button class="chip" data-trinw="${esc(k)}">${ic('x')} ${esc(nameOfKey(k))}</button>`).join('')}</div>` : ''}`;
}
function peersHTML() {
  return `${hint('Cuando alguien te mande su enlace de intercambio, ábrelo y aquí verás qué se pueden cambiar. También puedes pegarlo aquí.')}
    <div class="trman"><input type="url" id="trLink" placeholder="Pega aquí el enlace de intercambio de alguien" autocomplete="off"></div>
    ${S.peers.length ? `<div class="trpeers">${S.peers.map(p => { const t = decodeTrade(p.data); return t ? `<div class="trpeer"><button class="trpeerb" data-trpeer="${esc(p.id)}">${ic('user')}<span><b>${esc(p.name)}</b><small>Ofrece ${t.have.reduce((a, x) => a + x.n, 0)} · busca ${t.want.reduce((a, x) => a + x.n, 0)}</small></span>${ic('chevron')}</button><button class="btn ico" data-trpeerdel="${esc(p.id)}" title="Quitar" aria-label="Quitar">${ic('trash')}</button></div>` : ''; }).join('')}</div>`
      : hint('Todavía no has abierto la lista de nadie.')}`;
}
function peerHTML(p) {
  const t = decodeTrade(p.data); if (!t) return hint('No se pudo leer esta lista.');
  const mine = myList();
  const withPrice = (ms, from) => ms.map(m => ({ ...m, price: priceFor(m.code, m.finish || 'normal'), from }));
  const gets = withPrice(matchLists(t.have, mine.want, keyOfCode)), gives = withPrice(matchLists(mine.have, t.want, keyOfCode));
  const theirs = t.have.map(x => ({ ...x, price: priceFor(x.code, x.finish) })), theyWant = t.want.map(x => ({ ...x, price: priceFor(x.code) }));
  const who = esc(p.name), diff = total(gets) - total(gives);
  return `<button class="btn mini trback" data-trback>${ic('chevron')} Volver</button>
    <h2 class="trpeerh">Con ${who}</h2>
    ${gets.length || gives.length ? `<div class="trbal"><span><small>Recibes</small><b>${money(total(gets))}</b></span><span class="trbalx">${ic('flip')}</span><span><small>Das</small><b>${money(total(gives))}</b></span></div>
      ${total(gets) && total(gives) ? hint(Math.abs(diff) < 1 ? 'El cambio está parejo en valor.' : `Por precio, ${diff > 0 ? 'recibes' : 'das'} ~${money(Math.abs(diff))} más. Los precios son de TCGplayer, versión indicada.`) : ''}` : ''}
    <section class="trsec"><h3 class="trh">${who} te puede dar <small>${gets.length ? sum(gets) : 'nada de lo que buscas'}</small></h3>
      ${gets.length ? `<div class="trgrid">${gets.map(x => tile(x, 'data-trnop')).join('')}</div>` : ''}</section>
    <section class="trsec"><h3 class="trh">Tú le puedes dar <small>${gives.length ? sum(gives) : 'nada de lo que busca'}</small></h3>
      ${gives.length ? `<div class="trgrid">${gives.map(x => tile(x, 'data-trnop')).join('')}</div>` : ''}</section>
    <details class="trall"><summary>Todo lo que ofrece ${who} <small>${sum(theirs)}</small></summary><div class="trgrid">${theirs.map(x => tile(x, 'data-trnop')).join('') || hint('Nada.')}</div></details>
    <details class="trall"><summary>Todo lo que busca ${who} <small>${sum(theyWant)}</small></summary><div class="trgrid">${theyWant.map(x => tile(x, 'data-trnop')).join('') || hint('Nada.')}</div></details>`;
}
function render() {
  if (!V) return;
  for (const b of document.querySelectorAll('#trade [data-trtab]')) { const on = b.dataset.trtab === V.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }
  const peer = V.tab === 'peers' && V.peer && S.peers.find(p => p.id === V.peer);
  if (catalog()) {
    $('#trNHave').textContent = myHave().reduce((a, x) => a + x.n, 0) || '';
    $('#trNWant').textContent = myWant().reduce((a, x) => a + x.n, 0) || '';
  }
  $('#trNPeers').textContent = S.peers.length || '';
  $('#trBody').innerHTML = peer ? peerHTML(peer) : V.tab === 'want' ? wantHTML() : V.tab === 'peers' ? peersHTML() : haveHTML();
}

/* ---------- compartir ---------- */
function closeSheet() { const el = $('#trSheet'); if (el) { el.hidden = true; el.innerHTML = ''; } }
function openShare() {
  const el = $('#trSheet');
  el.innerHTML = `<div class="mspk trshare" role="dialog" aria-modal="true" aria-labelledby="trShT">
    <header><h2 id="trShT">Compartir mi lista</h2><button class="btn ico" data-trsclose aria-label="Cerrar">${ic('x')}</button></header>
    <label class="trlbl">Tu nombre (para que sepan de quién es)<input type="text" id="trName" maxlength="40" value="${esc(S.name)}" placeholder="Por ejemplo: Adrián de la tienda"></label>
    <p class="dlhint">La lista va dentro del enlace: quien lo abra ve lo que te sobra, lo que buscas y qué se pueden cambiar con su colección. No necesita cuenta.</p>
    <div class="trshb">
      ${navigator.share ? `<button class="btn primary" data-trshare>${ic('export')} Compartir…</button>` : ''}
      <button class="btn${navigator.share ? '' : ' primary'}" data-trcopytext>${ic('copy')} Copiar texto para WhatsApp</button>
      <button class="btn" data-trcopylink>${ic('copy')} Copiar solo el enlace</button>
    </div></div>`;
  el.hidden = false;
}
async function copy(text, ok) {
  try { await navigator.clipboard.writeText(text); toast(ok, 'ok'); }
  catch (e) { toast('No se pudo copiar. Mantén presionado para copiarlo a mano.', 'err'); }
}
function setName() { const v = $('#trName')?.value.trim().slice(0, 40) ?? S.name; if (v !== S.name) { S.name = v; save(); } }

export function init() {
  $('#coTrade').onclick = () => openTrade('have');
  $('#trClose').onclick = closeTrade;
  $('#trShareBtn').onclick = openShare;
  const root = $('#trade');
  root.addEventListener('click', e => {
    if (!V) return;
    const t = e.target.closest('[data-trtab]'); if (t) { V.tab = t.dataset.trtab; V.peer = null; render(); $('#trBody').scrollTop = 0; return; }
    const x = e.target.closest('[data-trexh]'); if (x) { S.exHave = [...new Set([...S.exHave, x.dataset.trexh])]; save(); render(); return; }
    const ih = e.target.closest('[data-trinh]'); if (ih) { S.exHave = S.exHave.filter(k => k !== ih.dataset.trinh); save(); render(); return; }
    const w = e.target.closest('[data-trexw]');
    if (w) { const k = w.dataset.trexw; if (S.add[k]) delete S.add[k]; else S.exWant = [...new Set([...S.exWant, k])]; save(); render(); return; }
    const iw = e.target.closest('[data-trinw]'); if (iw) { S.exWant = S.exWant.filter(k => k !== iw.dataset.trinw); save(); render(); return; }
    const pk = e.target.closest('[data-trpick]');
    if (pk) {
      const code = pk.dataset.trpick, k = keyOfCode(code);
      S.add[k] = { code, n: Math.min(3, (S.add[k]?.n || 0) + 1) }; S.exWant = S.exWant.filter(x => x !== k); save();
      toast(`Buscas ${S.add[k].n} ${nameOf(code)}`, 'ok'); render(); return;
    }
    const pr = e.target.closest('[data-trpeer]'); if (pr) { V.peer = pr.dataset.trpeer; render(); $('#trBody').scrollTop = 0; return; }
    const pd = e.target.closest('[data-trpeerdel]'); if (pd) { S.peers = S.peers.filter(p => p.id !== pd.dataset.trpeerdel); save(); render(); return; }
    if (e.target.closest('[data-trback]')) { V.peer = null; render(); return; }
    // compartir
    if (e.target.closest('[data-trsclose]') || e.target.id === 'trSheet') { setName(); closeSheet(); return; }
    if (e.target.closest('[data-trcopylink]')) { setName(); copy(shareUrl(), 'Enlace copiado'); return; }
    if (e.target.closest('[data-trcopytext]')) { setName(); copy(tradeText(myList(), nameOf, shareUrl()), 'Texto copiado: pégalo en el grupo'); return; }
    if (e.target.closest('[data-trshare]')) { setName(); navigator.share?.({ title: 'Mis intercambios de Riftbound', text: tradeText(myList(), nameOf, shareUrl()) }).catch(() => {}); return; }
  });
  root.addEventListener('input', e => {
    if (e.target.id === 'trQ') {
      const cat = catalog(); if (!cat) return;
      const hits = searchPrintings(e.target.value, cat.prints, norm, 8).filter(p => !p.token && p.type !== 'Rune');
      $('#trHits').innerHTML = hits.map(p => `<button class="chip" data-trpick="${esc(p.code)}">${ic('plus')} ${esc(p.name)} <small>${esc(p.code)}</small></button>`).join('');
    }
    if (e.target.id === 'trLink') {
      const m = e.target.value.match(/#trade=([\w-]+)/) || e.target.value.trim().match(/^([\w-]{8,})$/);
      if (m && openPeer(m[1])) e.target.value = '';
    }
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && V) { if (!$('#trSheet').hidden) { setName(); closeSheet(); } else closeTrade(); } });
  // abrir la lista de alguien (#trade=…): espera al catálogo para poder mostrar las cartas
  const m = location.hash.match(/^#trade=([\w-]+)/);
  if (m) {
    history.replaceState(null, '', location.pathname + location.search);
    const code = m[1];
    if (openPeer(code) && !catalog()) {
      const again = () => { if (catalog()) { document.removeEventListener('rb:cards', again); render(); } };
      document.addEventListener('rb:cards', again);
    }
  }
}
