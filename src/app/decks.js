// Constructor de mazos: catálogo con filtros, mazo con validación de reglas, estadísticas,
// importar/exportar en el formato del simulador y enlaces para compartir.
// Los mazos se guardan como proyectos ("rb_proj_deck:<id>"), así se sincronizan con la nube sin tablas nuevas;
// al borrar se deja una marca {deleted:true} para que el borrado también llegue a otras PCs.
import { noteLocalChange } from '../cloud/sync';
import { cardTextHTML, symbolHTML } from '../data/symbols';
import { norm } from '../data/text';
import { decodeDeck, encodeDeck, fromText, isCompleteList, toText } from '../deck/format';
import { emptyDeck, mainWithChampion, slotFor, total } from '../deck/model';
import { BATTLEFIELDS, MAIN_MIN, MAX_COPIES, RUNES, inIdentity, validateDeck } from '../deck/rules';
import { OPENING_HAND, atLeastOne, deckStats, mainSize, seenByTurn } from '../deck/stats';
import { $, ic } from './base';
import { _t } from '../i18n/i18n';
import { CARDS, cardByCode, deckCard, deckCatalog, printRank } from './cards';
import { deckRawOf } from './replay';
import { BR, BRIMG } from './brand';
import { captureToPng } from './capture';
import { isPremium } from '../cloud/plan';
import { DOC, toast } from './shell';
import { app } from './state';
import { closeModal, esc, openModal } from './utils';
import { deckCost, deckNeedsFor, hasCollection, ownedOf } from './collection';
import { missingList, tcgplayerList } from '../collection/needs';
import { latestPrices, money } from '../cloud/prices';
import { deckCounts, recordVersion } from '../deck/library';
import { initLib, renderDetail, renderLib } from './decklib';

const KEY = id => 'rb_proj_deck:' + id;
const get = code => deckCard(code);
const DOMS = ['Fury', 'Calm', 'Mind', 'Body', 'Chaos', 'Order'];
const DOM_ES = { Fury: 'Furia', Calm: 'Calma', Mind: 'Mente', Body: 'Cuerpo', Chaos: 'Caos', Order: 'Orden' };
const TYPE_ES = { Unit: 'Unidades', Spell: 'Hechizos', Gear: 'Equipo', Legend: 'Leyendas', Battlefield: 'Campos', Rune: 'Runas' };
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

let D = null;                 // mazo abierto
let SHARED = false;           // abierto desde un enlace: no se guarda hasta pulsar "Guardar en mis mazos"
let TAB = 'list', TO = 'main', LIMIT = 120;
const F = { q: '', dom: new Set(), type: '', cost: '', set: '', rar: '', fit: true, own: false, sort: 'cost' };

/* ---------- guardado ---------- */
export function allDecks() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i); if (!k?.startsWith('rb_proj_deck:')) continue;
    try { const d = JSON.parse(localStorage.getItem(k)); if (d && !d.deleted) out.push(d); } catch (e) {}
  }
  return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
/** Guarda un mazo ya (y avisa a la sincronización). */
export function writeDeck(d) {
  d.updatedAt = Date.now();
  try { localStorage.setItem(KEY(d.id), JSON.stringify({ ...d, ts: d.updatedAt })); } catch (e) {}
  noteLocalChange('projects');
}
/** Borra un mazo: queda una marca para que el borrado llegue también a otros dispositivos. */
export function deleteDeck(id) {
  localStorage.setItem(KEY(id), JSON.stringify({ id, deleted: true, ts: Date.now() }));
  noteLocalChange('projects');
}
let saveT = null;
function save() {
  if (!D || SHARED) return;
  clearTimeout(saveT);
  saveT = setTimeout(() => { saveT = null; if (D && !SHARED) writeDeck(D); }, 300);
}
function openDeck(d, shared = false) { D = d; SHARED = shared; LIMIT = 120; }
/** Mazo nuevo, directo al constructor. */
export function newDeck() {
  const d = emptyDeck(newId()); d.createdAt = Date.now(); writeDeck(d);
  openDeck(d); editDeck(true); $('#dbName').select();
}
/** Guarda un mazo recién creado (importado o compartido): su primera versión trae todas sus cartas. */
function adopt(d) {
  d.id = newId(); d.createdAt = Date.now(); d.history = []; recordVersion(d, {}); writeDeck(d);
}

/* ---------- vistas: galería, detalle y constructor ---------- */
let VIEW = 'lib';
let BASE = null;    // las cartas que tenía el mazo al empezar a editarlo: al terminar se guarda la versión
export const currentDeck = () => D;
export const isShared = () => SHARED;
/** Abre un mazo (sin mostrarlo todavía). */
export function useDeck(d, shared = false) { openDeck(d, shared); }
export function setView(v) {
  if (VIEW === 'edit' && v !== 'edit') leaveEdit();
  VIEW = v; $('#deckb').dataset.view = v;
  $('#hoverprev').classList.remove('show');
  if (v === 'lib') { D = null; SHARED = false; renderLib(); }
  else if (v === 'detail') renderDetail();
  else renderAll();
}
/** Al constructor con el mazo abierto. `fresh`: un mazo nuevo, todas sus cartas cuentan como su primera versión. */
export function editDeck(fresh = false) {
  BASE = SHARED ? null : fresh ? {} : deckCounts(D);
  setView('edit');
}
function leaveEdit() {
  const pending = saveT; clearTimeout(saveT); saveT = null;
  if (!D || SHARED) { BASE = null; return; }
  // un mazo nuevo que se dejó vacío no se queda en la galería
  if (!Object.keys(deckCounts(D)).length && D.name === 'Mazo nuevo' && !D.history?.length && !D.notes) { deleteDeck(D.id); D = null; BASE = null; return; }
  const changed = BASE && recordVersion(D, BASE);
  if (pending || changed) writeDeck(D);
  BASE = null;
}

/* ---------- reglas de agregar y quitar ---------- */
const copiesOf = name => Object.entries(mainWithChampion(D)).reduce((n, [code, k]) => n + (get(code)?.name === name ? k : 0), 0);
const sharesTag = (a, b) => a.tags.some(t => b.tags.includes(t));
function add(code, to = TO) {
  const c = get(code); if (!c) return;
  const slot = slotFor(c), legend = D.legend && get(D.legend);
  if (!slot) { toast('Las fichas (tokens) no van en el mazo.'); return; }
  if (slot === 'legend') { D.legend = code; toast(`Leyenda: ${c.name}`, 'ok'); }
  else if (slot === 'battlefield') {
    if (D.battlefields.some(b => get(b)?.name === c.name)) { toast('Ese campo ya está en tu mazo.'); return; }
    if (D.battlefields.length >= BATTLEFIELDS) { toast(`Ya tienes ${BATTLEFIELDS} campos: quita uno primero.`); return; }
    D.battlefields.push(code);
  }
  else if (slot === 'runes') D.runes[code] = (D.runes[code] || 0) + 1;
  else if (to === 'side') D.side[code] = (D.side[code] || 0) + 1;
  else {
    if (copiesOf(c.name) >= MAX_COPIES) { toast(`Máximo ${MAX_COPIES} copias de ${c.name}.`); return; }
    // la primera unidad campeón de tu leyenda se vuelve tu campeón elegido
    if (!D.champion && c.type === 'Unit' && c.sup === 'Champion' && legend && sharesTag(c, legend)) { D.champion = code; toast(`Campeón elegido: ${c.name}`, 'ok'); }
    else D.main[code] = (D.main[code] || 0) + 1;
  }
  save(); renderAll();
}
function remove(code, from) {
  const dec = r => { if (!r[code]) return false; if (--r[code] <= 0) delete r[code]; return true; };
  if (from === 'legend') D.legend = null;
  else if (from === 'champion') D.champion = null;
  else if (from === 'battlefields') D.battlefields = D.battlefields.filter(b => b !== code);
  else if (from) dec(D[from]);
  else if (!dec(D.main) && !dec(D.side) && !dec(D.runes)) {
    if (D.champion === code) D.champion = null; else if (D.legend === code) D.legend = null; else D.battlefields = D.battlefields.filter(b => b !== code);
  }
  save(); renderAll();
}
const inDeck = code => (D.legend === code ? 1 : 0) + (D.champion === code ? 1 : 0) + (D.main[code] || 0) + (D.runes[code] || 0) + (D.side[code] || 0) + D.battlefields.filter(b => b === code).length;

/* ---------- catálogo ---------- */
function filtered() {
  const legend = D.legend && get(D.legend), q = norm(F.q);
  const list = deckCatalog().filter(c => {
    if (q && !c.n.includes(q) && !norm(c.text).includes(q)) return false;
    if (F.dom.size && !(c.dom.length ? c.dom.some(d => F.dom.has(d)) : F.dom.has('none'))) return false;
    if (F.type === 'champ') { if (!(c.type === 'Unit' && c.sup === 'Champion' && (!legend || c.tags.some(t => legend.tags.includes(t))))) return false; }
    else if (F.type && c.type !== F.type) return false;
    if (F.cost !== '' && (F.cost === '7' ? !(c.e >= 7) : c.e !== +F.cost)) return false;
    if (F.set && c.set !== F.set) return false;
    if (F.rar && c.rar !== F.rar) return false;
    if (F.fit && legend && c.type !== 'Legend' && !inIdentity({ dom: c.dom }, legend.dom)) return false;
    if (F.own && !ownedOf(c)) return false;
    return true;
  });
  const by = { cost: (a, b) => (a.e ?? 99) - (b.e ?? 99) || a.name.localeCompare(b.name), name: (a, b) => a.name.localeCompare(b.name), might: (a, b) => (b.m ?? -1) - (a.m ?? -1) || a.name.localeCompare(b.name) };
  return list.sort(by[F.sort]);
}
function renderCatalog() {
  const list = filtered(), legend = D.legend && get(D.legend);
  $('#dbCount').textContent = `${list.length} carta${list.length === 1 ? '' : 's'}`;
  if (!CARDS.length) { $('#dbGrid').innerHTML = '<div class="dbempty">Cargando cartas…</div>'; return; }
  const coll = hasCollection();
  $('#dbGrid').innerHTML = list.slice(0, LIMIT).map(c => {
    const n = inDeck(c.code), off = legend && c.type !== 'Legend' && !inIdentity({ dom: c.dom }, legend.dom), own = coll ? ownedOf(c) : 0;
    return `<div class="dbc${n ? ' in' : ''}${off ? ' off' : ''}" data-code="${esc(c.code)}" title="${esc(c.name)}">
      <img src="${esc(c.img)}" loading="lazy" alt="">${n ? `<span class="dbn">${n}</span>` : ''}${own ? `<span class="dbown" title="Tienes ${own} en tu colección">${ic('binder')}${own}</span>` : ''}
      <div class="dbcb"><button class="btn mini ico" data-rm="${esc(c.code)}" title="Quitar una">−</button><button class="btn mini ico" data-add="${esc(c.code)}" title="Agregar una">+</button></div></div>`;
  }).join('') + (list.length > LIMIT ? `<div class="dbmore"><button class="btn" data-more>Mostrar más (${list.length - LIMIT})</button></div>` : '')
    + (!list.length ? '<div class="dbempty">Ninguna carta coincide con los filtros.</div>' : '');
}

/* ---------- panel del mazo ---------- */
export const domIcons = doms => doms.map(d => symbolHTML('rb_rune_' + d.toLowerCase()) || '').join('');
let NEEDS = null;   // por código: lo que tienes de cada carta del mazo (se arma en renderList)
function ownTag(code) {
  const x = NEEDS?.get(code); if (!x) return '';
  return x.miss ? `<span class="dbhave no" title="Tienes ${x.have} de ${x.n}">te faltan ${x.miss}</span>` : `<span class="dbhave ok" title="La tienes en tu colección">${ic('check')}</span>`;
}
function row(code, n, sec, bad) {
  const c = get(code), full = cardByCode(code);
  return `<div class="dbr${bad.has(code) ? ' bad' : ''}" data-code="${esc(code)}" style="--img:url('${esc(full?.img || '')}')">
    <span class="cost">${c?.e ?? (c?.type === 'Rune' ? '' : '–')}</span><span class="nm">${esc(c?.name || code)}</span>${domIcons(c?.dom || [])}
    ${n != null ? `<span class="q">×${n}</span>` : ''}${ownTag(code)}
    <button class="btn mini ico" data-rm="${esc(code)}" data-sec="${sec}" title="Quitar">−</button>${n != null ? `<button class="btn mini ico" data-add="${esc(code)}" data-sec="${sec}" title="Agregar">+</button>` : ''}</div>`;
}
const countTag = (n, goal, exact) => `<span class="dbcnt ${exact ? (n === goal ? 'ok' : 'no') : (n >= goal ? 'ok' : 'no')}">${n}/${goal}</span>`;
/** "Cuesta ~$X · te faltan N ($Y)" con precios de TCGplayer y tu colección. */
/** Las cartas del mazo (sin el banquillo), una entrada por código: { code, name, n }. */
export function deckCardsOf(d) {
  // el campeón elegido ya va dentro de mainWithChampion
  return [[d.legend, 1], ...Object.entries(mainWithChampion(d)), ...Object.entries(d.runes), ...d.battlefields.map(b => [b, 1])]
    .filter(([c, n]) => c && n).map(([code, n]) => ({ code, name: get(code)?.name || code, n }));
}
const deckCards = () => deckCardsOf(D);
function costLine() {
  const cards = deckCards();
  if (!cards.length) return '';
  const c = deckCost(cards);
  if (!c) return '';
  const miss = c.hasCollection ? (c.missN ? ` · te faltan ${c.missN} (${money(c.missCost)}) <button class="btn mini" data-missing>Ver qué me falta</button>` : ' · <b class="ok">tienes todas</b>') : '';
  return `<div class="dbcost" title="Precio de mercado en TCGplayer (EE. UU.) vía TCGCSV, cada carta a su versión más barata${c.unpriced ? `. ${c.unpriced} sin precio` : ''}">Cuesta ~<b>${money(c.cost)}</b>${miss}</div>`;
}
function renderList(issues) {
  NEEDS = hasCollection() ? new Map(deckNeedsFor(deckCards()).map(x => [x.code, x])) : null;
  const legend = D.legend && get(D.legend), legImg = D.legend && cardByCode(D.legend)?.img;
  const bad = new Set(issues.filter(i => i.level === 'error').flatMap(i => i.codes || []));
  const nMain = total(mainWithChampion(D)), nRunes = total(D.runes);
  const groups = { Unit: [], Spell: [], Gear: [], Otros: [] };
  Object.entries(D.main).sort((a, b) => (get(a[0])?.e ?? 99) - (get(b[0])?.e ?? 99) || (get(a[0])?.name || '').localeCompare(get(b[0])?.name || ''))
    .forEach(([code, n]) => (groups[get(code)?.type] || groups.Otros).push(row(code, n, 'main', bad)));
  const sec = (title, body, extra = '') => `<div class="dbsec"><h4>${title}${extra}</h4>${body}</div>`;
  const hint = (txt, type) => `<button class="dbslot" data-filter="${type}">${ic('plus')} ${txt}</button>`;
  $('#dbPanel').innerHTML = `
    <div class="dbhero"${legImg ? ` style="--img:url('${esc(legImg)}')"` : ''}>
      <b>${esc(legend?.name || 'Sin leyenda')}</b><span class="doms">${legend ? domIcons(legend.dom) : ''}</span>
      <div class="dbcnts">Principal ${countTag(nMain, MAIN_MIN)} · Runas ${countTag(nRunes, RUNES, true)} · Campos ${countTag(D.battlefields.length, BATTLEFIELDS, true)}</div>
      ${costLine()}
    </div>
    ${sec('Leyenda', D.legend ? row(D.legend, null, 'legend', bad) : hint('Elige una leyenda', 'Legend'))}
    ${sec('Campeón elegido', D.champion ? row(D.champion, null, 'champion', bad) : hint(legend ? `Elige un campeón de ${legend.name.split(',')[0]}` : 'Primero elige una leyenda', 'champ'))}
    ${sec('Mazo principal', ['Unit', 'Spell', 'Gear', 'Otros'].filter(t => groups[t].length).map(t => `<div class="dbsub">${TYPE_ES[t] || 'Otras'} <small>${groups[t].length}</small></div>${groups[t].join('')}`).join('') || '<div class="dbhint">Haz clic en las cartas del catálogo para agregarlas.</div>', ` ${countTag(nMain, MAIN_MIN)}`)}
    ${sec('Campos de batalla', D.battlefields.map(b => row(b, null, 'battlefields', bad)).join('') + (D.battlefields.length < BATTLEFIELDS ? hint('Agrega un campo', 'Battlefield') : ''), ` ${countTag(D.battlefields.length, BATTLEFIELDS, true)}`)}
    ${sec('Runas', Object.entries(D.runes).map(([c, n]) => row(c, n, 'runes', bad)).join('') + (nRunes < RUNES ? hint('Agrega runas', 'Rune') : ''), ` ${countTag(nRunes, RUNES, true)}`)}
    ${sec('Banquillo', Object.entries(D.side).map(([c, n]) => row(c, n, 'side', bad)).join('') || '<div class="dbhint">Elige "Agregar al: Banquillo" arriba del catálogo.</div>', ` <small>${total(D.side)}</small>`)}`;
}
function renderStats() {
  const s = deckStats(D, get), max = Math.max(1, ...s.curve), size = mainSize(D);
  const bars = (obj, label = k => k) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div class="dbbar"><span>${label(k)}</span><i style="width:${(n / Math.max(1, ...Object.values(obj))) * 100}%"></i><b>${n}</b></div>`).join('');
  const rows = Object.entries(D.main).map(([code, n]) => ({ c: get(code), n })).filter(x => x.c).sort((a, b) => b.n - a.n || a.c.name.localeCompare(b.c.name));
  const pct = p => Math.round(p * 100) + '%';
  $('#dbPanel').innerHTML = `
    <div class="dbsec"><h4>Curva de energía <small>promedio ${s.avgCost.toFixed(1)}</small></h4>
      <div class="dbcurve">${s.curve.map((n, k) => `<div><b>${n || ''}</b><i style="height:${(n / max) * 100}%"></i><span>${k === 7 ? '7+' : k}</span></div>`).join('')}</div></div>
    <div class="dbsec"><h4>Tipos</h4>${bars(s.types, k => TYPE_ES[k] || k)}</div>
    <div class="dbsec"><h4>Dominios</h4>${bars(s.domains, k => DOM_ES[k] || k)}<div class="dbhint">Poder total de las unidades: ⚔ ${s.might}</div></div>
    <div class="dbsec"><h4>Probabilidad de robarla</h4><div class="dbhint">Al menos una copia, en un mazo de ${size} cartas (el campeón empieza en su zona). Sin contar el mulligan.</div>
      <table class="dbprob"><tr><th></th><th>Copias</th><th>Mano inicial</th><th>Turno 3</th></tr>
      ${rows.map(x => `<tr><td>${esc(x.c.name)}</td><td>${x.n}</td><td>${pct(atLeastOne(size, x.n, seenByTurn(1)))}</td><td>${pct(atLeastOne(size, x.n, seenByTurn(3)))}</td></tr>`).join('')}</table></div>`;
}
/* ---------- mano de prueba ----------
   Se baraja el mazo principal (el campeón empieza en su zona), se roban 4 y se puede hacer mulligan:
   devolver hasta 2 cartas al fondo y robar otras tantas. Luego, una carta por turno. */
const MULL_MAX = 2;
const SIM = { lib: [], hand: [], pick: new Set(), turn: 1, mull: false, key: '' };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function simNew() {
  const lib = []; for (const [c, n] of Object.entries(D.main)) for (let k = 0; k < n; k++) lib.push(c);
  SIM.lib = shuffle(lib); SIM.hand = SIM.lib.splice(0, OPENING_HAND); SIM.pick.clear(); SIM.turn = 1; SIM.mull = false; SIM.key = D.id + JSON.stringify(D.main);
}
function simMulligan() {
  const back = SIM.hand.filter((_, k) => SIM.pick.has(k));
  SIM.hand = SIM.hand.filter((_, k) => !SIM.pick.has(k)).concat(SIM.lib.splice(0, back.length));
  SIM.lib.push(...back); SIM.pick.clear(); SIM.mull = true;
}
function simDraw() { if (SIM.lib.length) { SIM.hand.push(SIM.lib.shift()); SIM.turn++; SIM.mull = true; } }
function renderTest() {
  if (!Object.keys(D.main).length) { $('#dbPanel').innerHTML = '<div class="dbsec"><div class="dbhint">Agrega cartas al mazo principal para probar manos.</div></div>'; return; }
  if (SIM.key !== D.id + JSON.stringify(D.main)) simNew();
  const champ = D.champion && get(D.champion), picking = !SIM.mull;
  $('#dbPanel').innerHTML = `<div class="dbsec">
    <h4>${SIM.turn === 1 ? 'Mano inicial' : 'Turno ' + SIM.turn} <small>${SIM.lib.length} cartas en el mazo</small></h4>
    <div class="simbar"><button class="btn mini" data-sim="new">${ic('replay')} Nueva mano</button>
      ${picking ? `<button class="btn mini${SIM.pick.size ? ' primary' : ''}" data-sim="mull" ${SIM.pick.size ? '' : 'disabled'}>Mulligan (${SIM.pick.size}/${MULL_MAX})</button>` : ''}
      <button class="btn mini" data-sim="draw" ${SIM.lib.length ? '' : 'disabled'}>${ic('cards')} Robar</button></div>
    <div class="dbhint">${picking ? _t('Toca hasta {0} cartas para devolverlas al fondo del mazo y robar otras tantas.', MULL_MAX) : _t('Roba una carta por turno para ver cómo sigue tu partida.')}${champ ? ' ' + _t('Tu campeón, <b>{0}</b>, empieza en su zona.', esc(champ.name)) : ''}</div>
    <div class="simhand">${SIM.hand.map((c, k) => { const full = cardByCode(c); return `<div class="dbc simc${SIM.pick.has(k) ? ' pick' : ''}" data-code="${esc(c)}" data-hi="${k}" title="${esc(get(c)?.name || c)}"><img src="${esc(full?.img || '')}" alt=""></div>`; }).join('')}</div>
  </div>`;
}
function renderCheck(issues) {
  $('#dbPanel').innerHTML = issues.length
    ? `<div class="dbsec">${issues.map(i => `<div class="dbiss ${i.level}">${ic(i.level === 'error' ? 'x' : 'help')}<span>${esc(i.msg)}${i.codes?.length ? `<small>${i.codes.map(c => esc(get(c)?.name || c)).join(', ')}</small>` : ''}</span></div>`).join('')}</div>`
    : `<div class="dbok">${ic('check')}<b>Tu mazo cumple todas las reglas</b><small>Leyenda, campeón, ${MAIN_MIN}+ cartas, copias, firmas, ${RUNES} runas, ${BATTLEFIELDS} campos y dominios.</small></div>`;
}
function renderAll() {
  if (!D) return;
  const issues = validateDeck(D, get), errors = issues.filter(i => i.level === 'error').length;
  if (document.activeElement !== $('#dbName')) $('#dbName').value = D.name;
  $('#dbSaveShared').hidden = !SHARED;
  $('#dbIssues').textContent = errors || ''; $('#dbIssues').classList.toggle('ok', !errors);
  document.querySelectorAll('.dbtabs button').forEach(b => b.classList.toggle('on', b.dataset.dt === TAB));
  if (TAB === 'list') renderList(issues); else if (TAB === 'stats') renderStats(); else if (TAB === 'test') renderTest(); else renderCheck(issues);
  renderCatalog();
  $('#dbPaneN').textContent = `${total(mainWithChampion(D))}/${MAIN_MIN}`;
}

/* ---------- importar, exportar y compartir ---------- */
function resolve(name, code) {
  if (code && get(code)) return code.toUpperCase();
  // con solo el nombre, la impresión normal (no la promo ni el arte alterno)
  const k = norm(name), c = CARDS.filter(x => x.n === k).sort((a, b) => printRank(a) - printRank(b))[0];
  return c?.code || null;
}
/** Guarda el mazo importado y lo muestra. */
function imported(d, msg, err) { adopt(d); openDeck(d); setView('detail'); toast(msg, err ? 'err' : 'ok'); }
export function openImport() {
  const body = openModal('Importar mazo', `
    <div class="full hint">Pega la lista del simulador (por ejemplo "3 Stupefy [OGN-095]", con sus secciones Legend, Champion, MainDeck…) o un enlace de Riftviewer.</div>
    <textarea class="full chtxt" id="dbImp" rows="12" placeholder="Legend:&#10;1 Diana, Scorn of the Moon [UNL-234]&#10;&#10;MainDeck:&#10;3 Stupefy [OGN-095]"></textarea>`,
    [['Cancelar'], ['Importar', 'primary', () => {
      const raw = $('#dbImp').value.trim(); if (!raw) { alert('Pega una lista o un enlace.'); return false; }
      const link = raw.match(/#deck=([\w-]+)/);
      if (link) { const d = decodeDeck(link[1], newId()); if (!d) { alert('El enlace no es válido.'); return false; } imported(d, 'Mazo importado'); return; }
      const { deck, missing } = fromText(raw, newId(), resolve);
      deck.name = (deck.legend && get(deck.legend)?.name.split(',')[0]) || 'Mazo importado';
      imported(deck, missing.length ? `Importado. No se reconocieron: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}` : 'Mazo importado', missing.length);
    }]]);
  setTimeout(() => body.querySelector('textarea')?.focus(), 50);
}
/** Las cartas del mazo que no tienes, con precio, para copiarlas a la compra masiva de TCGplayer. */
export function openMissing() {
  const miss = missingList(deckNeedsFor(deckCards()));
  if (!miss.length) { toast('Tienes todas las cartas de este mazo.', 'ok'); return; }
  const n = miss.reduce((a, x) => a + x.miss, 0), priced = miss.filter(x => x.price != null), cost = priced.reduce((a, x) => a + x.price * x.miss, 0);
  const txt = tcgplayerList(miss);
  const body = openModal(`Te faltan ${n} carta${n === 1 ? '' : 's'}`, `
    <div class="full hint">Cuentan tus copias de cualquier versión. Precio de mercado en TCGplayer (EE. UU.) vía <a href="https://tcgcsv.com" target="_blank" rel="noopener">TCGCSV</a>, cada carta a su versión más barata.</div>
    <table class="full dbmiss"><tr><th>Carta</th><th>Tienes</th><th>Faltan</th><th>Precio</th><th>Total</th></tr>
      ${miss.map(x => `<tr><td>${esc(x.name)}</td><td>${x.have}/${x.n}</td><td><b>${x.miss}</b></td><td>${x.price != null ? money(x.price) : '—'}</td><td>${x.price != null ? money(x.price * x.miss) : '—'}</td></tr>`).join('')}
      <tr class="tot"><td colspan="4">Total${priced.length < miss.length ? ` (${miss.length - priced.length} sin precio)` : ''}</td><td>${money(Math.round(cost * 100) / 100)}</td></tr></table>
    <div class="full hint">Para comprarlas: copia la lista y pégala en la <b>compra masiva</b> (Mass Entry) de TCGplayer.</div>
    <textarea class="full chtxt" readonly rows="6">${esc(txt)}</textarea>`,
    [['Abrir TCGplayer', 'ghost', () => { window.open('https://www.tcgplayer.com/massentry', '_blank', 'noopener'); return false; }],
     ['Cerrar'], ['Copiar lista', 'primary', () => { copy(txt, 'Lista copiada: pégala en TCGplayer'); return false; }]]);
  body.querySelector('textarea').onclick = e => e.target.select();
}
function copy(text, msg) { navigator.clipboard?.writeText(text).then(() => toast(msg, 'ok')).catch(() => {}); }
export function openExport() {
  const txt = toText(D, get);
  const body = openModal('Exportar mazo', `
    <div class="full hint">Formato del simulador: puedes pegarlo directamente al registrar tu mazo.</div>
    <textarea class="full chtxt" readonly rows="14">${esc(txt)}</textarea>`,
    [['Descargar .txt', 'ghost', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = `${(D.name || 'mazo').replace(/[^\w-]+/g, '_')}.txt`; a.click(); return false; }],
     ['Cerrar'], ['Copiar lista', 'primary', () => { copy(txt, 'Lista copiada'); return false; }]]);
  body.querySelector('textarea').onclick = e => e.target.select();
}
export function openShare() {
  const url = `${location.origin}${location.pathname}#deck=${encodeDeck(D)}`;
  const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
  const body = openModal('Compartir mazo', `
    <div class="full hint">Quien abra este enlace verá tu mazo en Riftviewer y podrá guardar una copia. No necesita cuenta.${local ? ' <b>Ojo:</b> ahora estás en tu PC (localhost), así que el enlace solo funciona aquí hasta que Riftviewer esté publicado.' : ''}</div>
    <input type="text" class="full" readonly value="${esc(url)}">`,
    [['Cerrar'], ['Copiar enlace', 'primary', () => { copy(url, 'Enlace copiado'); return false; }]]);
  body.querySelector('input').onclick = e => e.target.select();
}

/* ---------- imagen del mazo para redes (1920×1080) ---------- */
function sheetHTML() {
  const legend = D.legend && get(D.legend), legImg = D.legend && cardByCode(D.legend)?.img, champ = D.champion && cardByCode(D.champion);
  const rows = Object.entries(D.main).sort((a, b) => (get(a[0])?.e ?? 99) - (get(b[0])?.e ?? 99) || (get(a[0])?.name || '').localeCompare(get(b[0])?.name || ''));
  // columnas: las menos posibles para que todas las cartas quepan en el área (1300×700)
  let cols = 6; for (; cols < 14; cols++) { const w = (1300 - (cols - 1) * 12) / cols, r = Math.ceil(rows.length / cols); if (r * w * 1.396 + (r - 1) * 12 <= 700) break; }
  const brand = (isPremium() && BRIMG.logo ? `<img src="${BRIMG.logo}">` : '') + (BR.name ? `<span>${esc(BR.name)}</span>` : '');
  return `<div class="ds-left">
      ${legImg ? `<img class="ds-leg" src="${esc(legImg)}" alt="">` : '<div class="ds-leg"></div>'}
      <div class="ds-name">${esc(D.name)}</div>
      <div class="ds-sub">${esc(legend?.name || '')} <span>${legend ? domIcons(legend.dom) : ''}</span></div>
      ${champ ? `<div class="ds-champ"><img src="${esc(champ.img)}" alt=""><span><small>Campeón</small>${esc(champ.name)}</span></div>` : ''}
      <div class="ds-meta">${total(mainWithChampion(D))} cartas · ${total(D.runes)} runas</div>
      ${brand ? `<div class="ds-brand">${brand}</div>` : ''}
    </div>
    <div class="ds-right">
      <div class="ds-grid" style="--cols:${cols}">${rows.map(([c, n]) => `<div class="ds-c"><img src="${esc(cardByCode(c)?.img || '')}" alt=""><b>${n}</b></div>`).join('')}</div>
      <div class="ds-foot">
        <div class="ds-bfs">${D.battlefields.map(b => `<img src="${esc(cardByCode(b)?.img || '')}" alt="">`).join('')}</div>
        <div class="ds-runes">${Object.entries(D.runes).map(([c, n]) => `<span>${domIcons(get(c)?.dom || [])}<b>×${n}</b></span>`).join('')}</div>
      </div>
    </div>
    <div class="ds-mark">Hecho con <b>Riftviewer</b> · cartas: Riftcodex y OpenRift</div>`;
}
const fitSheet = () => $('#dsheet').style.setProperty('--k', Math.min(innerWidth / 1920, innerHeight / 1080));
export function exportImage() {
  if (!Object.keys(D.main).length) { toast('Agrega cartas al mazo primero.', 'err'); return; }
  const wrap = $('#dsheetw'), sheet = $('#dsheet');
  captureToPng({
    w: 1920, h: 1080, file: `mazo-${(D.name || 'riftviewer').replace(/[^\w-]+/g, '_').slice(0, 40)}.png`,
    title: 'Todo listo para la imagen', msg: 'Al pulsar el botón, la pantalla se pondrá completa un momento y se guardará la imagen de tu mazo.',
    // la escala se recalcula al cambiar el tamaño: la pantalla completa termina de abrirse después de mostrar la hoja
    show: () => { sheet.innerHTML = sheetHTML(); wrap.hidden = false; fitSheet(); addEventListener('resize', fitSheet); return sheet; },
    hide: () => { removeEventListener('resize', fitSheet); wrap.hidden = true; sheet.innerHTML = ''; },
  });
}

/* ---------- vista ampliada al pasar el ratón ---------- */
let hpT = null;
function preview(code, x, y) {
  const el = $('#hoverprev'), c = cardByCode(code); if (!c) return;
  el.classList.remove('land', 'pinned');
  el.innerHTML = `<img src="${esc(c.img)}" alt=""><div class="hn">${esc(c.name)}</div>${c.text || c.rich ? `<div class="ht">${cardTextHTML(c.rich, c.text)}</div>` : ''}`;
  el.classList.add('show');
  const r = el.getBoundingClientRect(), left = x + 24 + r.width > innerWidth ? x - r.width - 24 : x + 24;
  el.style.left = Math.max(8, left) + 'px'; el.style.top = Math.max(8, Math.min(innerHeight - r.height - 8, y - r.height / 2)) + 'px';
}

/* ---------- abrir y cerrar la sección ---------- */
/** Vuelve a dibujar la vista que se ve (llegaron precios, cartas, tu colección…). */
export function refresh() {
  if ($('#deckb').hidden) return;
  if (VIEW === 'lib') renderLib(); else if (VIEW === 'detail') renderDetail(); else if (D) renderAll();
}
/** Abre la sección: un mazo compartido (`d`) va a su página; si no, a donde te quedaste o a la galería. */
export function showDecks(d) {
  $('#dbOwnW').hidden = !hasCollection();
  latestPrices().then(p => { if (p) refresh(); }).catch(() => {});
  $('#home').classList.remove('show'); $('#deckb').hidden = false; document.body.classList.add('indecks');
  if (d) { openDeck(d, true); setView('detail'); }
  else setView(VIEW === 'detail' && D ? 'detail' : 'lib');
}
/** "Guardar en mis mazos" de un mazo compartido. */
export function saveShared() {
  SHARED = false; adopt(D);
  if (VIEW === 'edit') BASE = deckCounts(D);
  refresh(); toast('Guardado en tus mazos', 'ok');
}
/** abre en el constructor el mazo con el que jugó alguien en el replay abierto (sin guardarlo todavía) */
export function openReplayDeck(pid) {
  const last = app.R?.frames[app.R.frames.length - 1]?.state, p = last?.players.find(x => x.id === pid), raw = deckRawOf(p);
  if (!isCompleteList(raw)) { toast('Este replay no trae la lista completa de ese jugador.', 'err'); return; }
  const { deck, missing } = fromText(raw, newId(), resolve);
  deck.name = `${p.name} · ${(deck.legend && get(deck.legend)?.name.split(',')[0]) || 'mazo'}`;
  showDecks(deck);
  if (missing.length) toast(`No se reconocieron: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}`, 'err');
}
export function hideDecks() {
  // si estabas editando, se guarda la versión; al volver ves la página del mazo
  if (VIEW === 'edit') { leaveEdit(); VIEW = D ? 'detail' : 'lib'; $('#deckb').dataset.view = VIEW; }
  $('#deckb').hidden = true; document.body.classList.remove('indecks'); $('#hoverprev').classList.remove('show');
}

/* ---------- teléfono: catálogo o mazo, y filtros plegados ---------- */
// ¿hay ratón? (sin matchMedia, como en las pruebas, se asume que sí)
export const hasHover = () => typeof matchMedia !== 'function' || matchMedia('(hover: hover)').matches;
function setPane(p) {
  $('#deckb').dataset.pane = p;
  document.querySelectorAll('.dbpanes [data-pane]').forEach(b => b.classList.toggle('on', b.dataset.pane === p));
}
export function init() {
  $('#deckb').dataset.pane = 'cat';
  $('.dbpanes').onclick = e => { const b = e.target.closest('[data-pane]'); if (b) setPane(b.dataset.pane); };
  $('#dbFiltBtn').onclick = () => { const o = $('#deckb .dbfilters').classList.toggle('open'); $('#dbFiltBtn').setAttribute('aria-expanded', String(o)); };
  // filtros: dominios como botones con su icono, y los sets y rarezas que existan en el catálogo
  $('#dbDom').innerHTML = DOMS.map(d => `<button class="chip" data-dom="${d}" title="${DOM_ES[d]}">${symbolHTML('rb_rune_' + d.toLowerCase())}</button>`).join('') + '<button class="chip" data-dom="none" title="Sin dominio">Sin dominio</button>';
  const fillSelects = () => {
    const sets = [...new Set(CARDS.map(c => c.set).filter(Boolean))].sort(), rars = ['Common', 'Uncommon', 'Rare', 'Epic', 'Showcase', 'Promo'];
    $('#dbSet').innerHTML = '<option value="">Todos los sets</option>' + sets.map(s => `<option>${s}</option>`).join('');
    $('#dbRar').innerHTML = '<option value="">Todas las rarezas</option>' + rars.map(r => `<option>${r}</option>`).join('');
  };
  fillSelects();
  document.addEventListener('rb:cards', () => { fillSelects(); refresh(); });
  // tu colección cambió (escáner, otra PC): se actualizan las marcas de lo que tienes
  document.addEventListener('rb:collection', () => { $('#dbOwnW').hidden = !hasCollection(); refresh(); });
  // llegaron mazos de otro dispositivo
  document.addEventListener('rb:projects', () => {
    if ($('#deckb').hidden || VIEW === 'edit') return;
    if (VIEW === 'detail' && D && !SHARED) { const fresh = allDecks().find(x => x.id === D.id); if (!fresh) { setView('lib'); return; } D = fresh; }
    refresh();
  });
  // al cerrar o recargar mientras editas, también se guarda la versión
  addEventListener('pagehide', () => {
    if (VIEW !== 'edit' || !D || SHARED) return;
    const changed = BASE && recordVersion(D, BASE);
    if (changed || saveT) { clearTimeout(saveT); saveT = null; writeDeck(D); }
    if (BASE) BASE = deckCounts(D);
  });

  $('#hDecks').onclick = () => showDecks();
  $('#pinfo').addEventListener('click', e => { const b = e.target.closest('[data-deckof]'); if (b) openReplayDeck(b.dataset.deckof); });
  $('#dbBack').onclick = () => setView('detail');
  $('#dbSaveShared').onclick = saveShared;
  $('#dbName').oninput = e => { D.name = e.target.value; save(); };
  initLib();

  const fbar = $('#deckb .dbfilters');
  fbar.addEventListener('input', e => {
    const t = e.target; LIMIT = 120;
    if (t.id === 'dbQ') F.q = t.value; if (t.id === 'dbType') F.type = t.value; if (t.id === 'dbCost') F.cost = t.value;
    if (t.id === 'dbSet') F.set = t.value; if (t.id === 'dbRar') F.rar = t.value; if (t.id === 'dbFit') F.fit = t.checked; if (t.id === 'dbOwn') F.own = t.checked; if (t.id === 'dbSort') F.sort = t.value;
    renderCatalog();
  });
  fbar.addEventListener('click', e => {
    const d = e.target.closest('[data-dom]'); if (d) { F.dom.has(d.dataset.dom) ? F.dom.delete(d.dataset.dom) : F.dom.add(d.dataset.dom); d.classList.toggle('on'); LIMIT = 120; renderCatalog(); }
    const to = e.target.closest('[data-to]'); if (to) { TO = to.dataset.to; fbar.querySelectorAll('[data-to]').forEach(b => b.classList.toggle('on', b === to)); }
  });
  $('#dbGrid').addEventListener('click', e => {
    if (e.target.closest('[data-more]')) { LIMIT += 120; renderCatalog(); return; }
    const rm = e.target.closest('[data-rm]'); if (rm) { remove(rm.dataset.rm); return; }
    const c = e.target.closest('[data-code]'); if (c) add(c.dataset.code, e.shiftKey ? 'side' : TO);
  });
  $('#dbGrid').addEventListener('contextmenu', e => { const c = e.target.closest('[data-code]'); if (c) { e.preventDefault(); remove(c.dataset.code); } });
  $('#dbPanel').addEventListener('click', e => {
    if (e.target.closest('[data-missing]')) { openMissing(); return; }
    const sim = e.target.closest('[data-sim]');
    if (sim) { ({ new: simNew, mull: simMulligan, draw: simDraw })[sim.dataset.sim](); renderTest(); return; }
    const hi = e.target.closest('[data-hi]');
    if (hi) { if (SIM.mull) return; const k = +hi.dataset.hi; SIM.pick.has(k) ? SIM.pick.delete(k) : SIM.pick.size < MULL_MAX && SIM.pick.add(k); renderTest(); return; }
    const a = e.target.closest('[data-add]'); if (a) { add(a.dataset.add, a.dataset.sec === 'side' ? 'side' : 'main'); return; }
    const r = e.target.closest('[data-rm]'); if (r) { remove(r.dataset.rm, r.dataset.sec); return; }
    const f = e.target.closest('[data-filter]'); if (f) { F.type = f.dataset.filter; $('#dbType').value = F.type; LIMIT = 120; renderCatalog(); $('#dbGrid').scrollTop = 0; setPane('cat'); }
  });
  document.querySelector('.dbtabs').onclick = e => { const b = e.target.closest('[data-dt]'); if (b) { TAB = b.dataset.dt; renderAll(); } };
  // vista ampliada en el catálogo y en la lista
  $('#deckb').addEventListener('mouseover', e => { if (!hasHover()) return; const t = e.target.closest('.dbc,.dbr,.ddc'); if (!t) return; clearTimeout(hpT); hpT = setTimeout(() => preview(t.dataset.code, e.clientX, e.clientY), 250); });
  $('#deckb').addEventListener('mouseout', e => { if (e.target.closest('.dbc,.dbr,.ddc') && !e.relatedTarget?.closest?.('.dbc,.dbr,.ddc')) { clearTimeout(hpT); $('#hoverprev').classList.remove('show'); } });

  // abrir un mazo compartido (#deck=…)
  const m = location.hash.match(/^#deck=([\w-]+)/);
  if (m) { const d = decodeDeck(m[1], 'shared'); if (d) { history.replaceState(null, '', location.pathname + location.search); showDecks(d); } }
}
