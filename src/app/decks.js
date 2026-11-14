// Constructor de mazos: catálogo con filtros, mazo con validación de reglas, estadísticas,
// importar/exportar en el formato de RiftAtlas y enlaces para compartir.
// Los mazos se guardan como proyectos ("rb_proj_deck:<id>"), así se sincronizan con la nube sin tablas nuevas;
// al borrar se deja una marca {deleted:true} para que el borrado también llegue a otras PCs.
import { noteLocalChange } from '../cloud/sync';
import { cardTextHTML, symbolHTML } from '../data/symbols';
import { norm } from '../data/text';
import { decodeDeck, encodeDeck, fromText, toText } from '../deck/format';
import { emptyDeck, mainWithChampion, slotFor, total } from '../deck/model';
import { BATTLEFIELDS, MAIN_MIN, MAX_COPIES, RUNES, inIdentity, validateDeck } from '../deck/rules';
import { atLeastOne, deckStats, mainSize, seenByTurn } from '../deck/stats';
import { $, ic } from './base';
import { CARDS, cardByCode, deckCard, deckCatalog } from './cards';
import { toast } from './shell';
import { closeModal, esc, openModal } from './utils';

const KEY = id => 'rb_proj_deck:' + id;
const get = code => deckCard(code);
const DOMS = ['Fury', 'Calm', 'Mind', 'Body', 'Chaos', 'Order'];
const DOM_ES = { Fury: 'Furia', Calm: 'Calma', Mind: 'Mente', Body: 'Cuerpo', Chaos: 'Caos', Order: 'Orden' };
const TYPE_ES = { Unit: 'Unidades', Spell: 'Hechizos', Gear: 'Equipo', Legend: 'Leyendas', Battlefield: 'Campos', Rune: 'Runas' };
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

let D = null;                 // mazo abierto
let SHARED = false;           // abierto desde un enlace: no se guarda hasta pulsar "Guardar en mis mazos"
let TAB = 'list', TO = 'main', LIMIT = 120;
const F = { q: '', dom: new Set(), type: '', cost: '', set: '', rar: '', fit: true, sort: 'cost' };

/* ---------- guardado ---------- */
function allDecks() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i); if (!k?.startsWith('rb_proj_deck:')) continue;
    try { const d = JSON.parse(localStorage.getItem(k)); if (d && !d.deleted) out.push(d); } catch (e) {}
  }
  return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
let saveT = null;
function save() {
  if (!D || SHARED) return;
  clearTimeout(saveT);
  saveT = setTimeout(() => { D.updatedAt = Date.now(); try { localStorage.setItem(KEY(D.id), JSON.stringify({ ...D, ts: D.updatedAt })); } catch (e) {} noteLocalChange('projects'); renderDeckList(); }, 300);
}
function openDeck(d, shared = false) { D = d; SHARED = shared; LIMIT = 120; renderAll(); }
function newDeck() { openDeck(emptyDeck(newId())); save(); $('#dbName').select(); }

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
    return true;
  });
  const by = { cost: (a, b) => (a.e ?? 99) - (b.e ?? 99) || a.name.localeCompare(b.name), name: (a, b) => a.name.localeCompare(b.name), might: (a, b) => (b.m ?? -1) - (a.m ?? -1) || a.name.localeCompare(b.name) };
  return list.sort(by[F.sort]);
}
function renderCatalog() {
  const list = filtered(), legend = D.legend && get(D.legend);
  $('#dbCount').textContent = `${list.length} carta${list.length === 1 ? '' : 's'}`;
  if (!CARDS.length) { $('#dbGrid').innerHTML = '<div class="dbempty">Cargando cartas…</div>'; return; }
  $('#dbGrid').innerHTML = list.slice(0, LIMIT).map(c => {
    const n = inDeck(c.code), off = legend && c.type !== 'Legend' && !inIdentity({ dom: c.dom }, legend.dom);
    return `<div class="dbc${n ? ' in' : ''}${off ? ' off' : ''}" data-code="${esc(c.code)}" title="${esc(c.name)}">
      <img src="${esc(c.img)}" loading="lazy" alt="">${n ? `<span class="dbn">${n}</span>` : ''}
      <div class="dbcb"><button class="btn mini ico" data-rm="${esc(c.code)}" title="Quitar una">−</button><button class="btn mini ico" data-add="${esc(c.code)}" title="Agregar una">+</button></div></div>`;
  }).join('') + (list.length > LIMIT ? `<div class="dbmore"><button class="btn" data-more>Mostrar más (${list.length - LIMIT})</button></div>` : '')
    + (!list.length ? '<div class="dbempty">Ninguna carta coincide con los filtros.</div>' : '');
}

/* ---------- panel del mazo ---------- */
const domIcons = doms => doms.map(d => symbolHTML('rb_rune_' + d.toLowerCase()) || '').join('');
function row(code, n, sec, bad) {
  const c = get(code), full = cardByCode(code);
  return `<div class="dbr${bad.has(code) ? ' bad' : ''}" data-code="${esc(code)}" style="--img:url('${esc(full?.img || '')}')">
    <span class="cost">${c?.e ?? (c?.type === 'Rune' ? '' : '–')}</span><span class="nm">${esc(c?.name || code)}</span>${domIcons(c?.dom || [])}
    ${n != null ? `<span class="q">×${n}</span>` : ''}
    <button class="btn mini ico" data-rm="${esc(code)}" data-sec="${sec}" title="Quitar">−</button>${n != null ? `<button class="btn mini ico" data-add="${esc(code)}" data-sec="${sec}" title="Agregar">+</button>` : ''}</div>`;
}
const countTag = (n, goal, exact) => `<span class="dbcnt ${exact ? (n === goal ? 'ok' : 'no') : (n >= goal ? 'ok' : 'no')}">${n}/${goal}</span>`;
function renderList(issues) {
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
function renderCheck(issues) {
  $('#dbPanel').innerHTML = issues.length
    ? `<div class="dbsec">${issues.map(i => `<div class="dbiss ${i.level}">${ic(i.level === 'error' ? 'x' : 'help')}<span>${esc(i.msg)}${i.codes?.length ? `<small>${i.codes.map(c => esc(get(c)?.name || c)).join(', ')}</small>` : ''}</span></div>`).join('')}</div>`
    : `<div class="dbok">${ic('check')}<b>Tu mazo cumple todas las reglas</b><small>Leyenda, campeón, ${MAIN_MIN}+ cartas, copias, firmas, ${RUNES} runas, ${BATTLEFIELDS} campos y dominios.</small></div>`;
}
function renderDeckList() {
  const list = allDecks();
  $('#dbList').innerHTML = (SHARED ? `<option value="">${esc(D.name)} (compartido)</option>` : '')
    + list.map(d => `<option value="${esc(d.id)}">${esc(d.name || 'Sin nombre')}</option>`).join('');
  if (!SHARED) $('#dbList').value = D.id;
}
function renderAll() {
  if (!D) return;
  const issues = validateDeck(D, get), errors = issues.filter(i => i.level === 'error').length;
  if (document.activeElement !== $('#dbName')) $('#dbName').value = D.name;
  $('#dbSaveShared').hidden = !SHARED;
  $('#dbIssues').textContent = errors || ''; $('#dbIssues').classList.toggle('ok', !errors);
  document.querySelectorAll('.dbtabs button').forEach(b => b.classList.toggle('on', b.dataset.dt === TAB));
  if (TAB === 'list') renderList(issues); else if (TAB === 'stats') renderStats(); else renderCheck(issues);
  renderCatalog(); renderDeckList();
}

/* ---------- importar, exportar y compartir ---------- */
function resolve(name, code) {
  if (code && get(code)) return code.toUpperCase();
  const k = norm(name), c = CARDS.find(x => x.n === k && !x.alt) || CARDS.find(x => x.n === k);
  return c?.code || null;
}
function openImport() {
  const body = openModal('Importar mazo', `
    <div class="full hint">Pega la lista de RiftAtlas (por ejemplo "3 Stupefy [OGN-095]", con sus secciones Legend, Champion, MainDeck…) o un enlace de Riftviewer.</div>
    <textarea class="full chtxt" id="dbImp" rows="12" placeholder="Legend:&#10;1 Diana, Scorn of the Moon [UNL-234]&#10;&#10;MainDeck:&#10;3 Stupefy [OGN-095]"></textarea>`,
    [['Cancelar'], ['Importar', 'primary', () => {
      const raw = $('#dbImp').value.trim(); if (!raw) { alert('Pega una lista o un enlace.'); return false; }
      const link = raw.match(/#deck=([\w-]+)/);
      if (link) { const d = decodeDeck(link[1], newId()); if (!d) { alert('El enlace no es válido.'); return false; } openDeck(d); save(); toast('Mazo importado', 'ok'); return; }
      const { deck, missing } = fromText(raw, newId(), resolve);
      deck.name = (deck.legend && get(deck.legend)?.name.split(',')[0]) || 'Mazo importado';
      openDeck(deck); save();
      toast(missing.length ? `Importado. No se reconocieron: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}` : 'Mazo importado', missing.length ? 'err' : 'ok');
    }]]);
  setTimeout(() => body.querySelector('textarea')?.focus(), 50);
}
function copy(text, msg) { navigator.clipboard?.writeText(text).then(() => toast(msg, 'ok')).catch(() => {}); }
function openExport() {
  const txt = toText(D, get);
  const body = openModal('Exportar mazo', `
    <div class="full hint">Formato de RiftAtlas: puedes pegarlo directamente al registrar tu mazo.</div>
    <textarea class="full chtxt" readonly rows="14">${esc(txt)}</textarea>`,
    [['Descargar .txt', 'ghost', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = `${(D.name || 'mazo').replace(/[^\w-]+/g, '_')}.txt`; a.click(); return false; }],
     ['Cerrar'], ['Copiar lista', 'primary', () => { copy(txt, 'Lista copiada'); return false; }]]);
  body.querySelector('textarea').onclick = e => e.target.select();
}
function openShare() {
  const url = `${location.origin}${location.pathname}#deck=${encodeDeck(D)}`;
  const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
  const body = openModal('Compartir mazo', `
    <div class="full hint">Quien abra este enlace verá tu mazo en Riftviewer y podrá guardar una copia. No necesita cuenta.${local ? ' <b>Ojo:</b> ahora estás en tu PC (localhost), así que el enlace solo funciona aquí hasta que Riftviewer esté publicado.' : ''}</div>
    <input type="text" class="full" readonly value="${esc(url)}">`,
    [['Cerrar'], ['Copiar enlace', 'primary', () => { copy(url, 'Enlace copiado'); return false; }]]);
  body.querySelector('input').onclick = e => e.target.select();
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
export function showDecks(d) {
  $('#home').classList.remove('show'); $('#deckb').hidden = false; document.body.classList.add('indecks');
  if (d) openDeck(d, true);
  else if (!D) { const last = allDecks()[0]; if (last) openDeck(last); else newDeck(); }
  else renderAll();
}
export function hideDecks() { $('#deckb').hidden = true; document.body.classList.remove('indecks'); $('#hoverprev').classList.remove('show'); }

export function init() {
  // filtros: dominios como botones con su icono, y los sets y rarezas que existan en el catálogo
  $('#dbDom').innerHTML = DOMS.map(d => `<button class="chip" data-dom="${d}" title="${DOM_ES[d]}">${symbolHTML('rb_rune_' + d.toLowerCase())}</button>`).join('') + '<button class="chip" data-dom="none" title="Sin dominio">Sin dominio</button>';
  const fillSelects = () => {
    const sets = [...new Set(CARDS.map(c => c.set).filter(Boolean))].sort(), rars = ['Common', 'Uncommon', 'Rare', 'Epic', 'Showcase', 'Promo'];
    $('#dbSet').innerHTML = '<option value="">Todos los sets</option>' + sets.map(s => `<option>${s}</option>`).join('');
    $('#dbRar').innerHTML = '<option value="">Todas las rarezas</option>' + rars.map(r => `<option>${r}</option>`).join('');
  };
  fillSelects();
  document.addEventListener('rb:cards', () => { fillSelects(); if (!$('#deckb').hidden) renderAll(); });

  $('#bDecks').onclick = () => showDecks();
  $('#hDecks').onclick = () => showDecks();
  $('#dbBack').onclick = () => { hideDecks(); $('#home').classList.add('show'); };
  $('#dbNew').onclick = newDeck;
  $('#dbImport').onclick = openImport;
  $('#dbExport').onclick = openExport;
  $('#dbShare').onclick = openShare;
  $('#dbSaveShared').onclick = () => { SHARED = false; D.id = newId(); save(); renderAll(); toast('Guardado en tus mazos', 'ok'); };
  $('#dbDel').onclick = () => {
    if (!confirm(`¿Borrar el mazo "${D.name}"? Esto no se puede deshacer.`)) return;
    if (!SHARED) { localStorage.setItem(KEY(D.id), JSON.stringify({ id: D.id, deleted: true, ts: Date.now() })); noteLocalChange('projects'); }
    D = null; SHARED = false; const next = allDecks()[0]; if (next) openDeck(next); else newDeck();
  };
  $('#dbList').onchange = e => { const d = allDecks().find(x => x.id === e.target.value); if (d) openDeck(d); };
  $('#dbName').oninput = e => { D.name = e.target.value; save(); };

  const fbar = $('#deckb .dbfilters');
  fbar.addEventListener('input', e => {
    const t = e.target; LIMIT = 120;
    if (t.id === 'dbQ') F.q = t.value; if (t.id === 'dbType') F.type = t.value; if (t.id === 'dbCost') F.cost = t.value;
    if (t.id === 'dbSet') F.set = t.value; if (t.id === 'dbRar') F.rar = t.value; if (t.id === 'dbFit') F.fit = t.checked; if (t.id === 'dbSort') F.sort = t.value;
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
    const a = e.target.closest('[data-add]'); if (a) { add(a.dataset.add, a.dataset.sec === 'side' ? 'side' : 'main'); return; }
    const r = e.target.closest('[data-rm]'); if (r) { remove(r.dataset.rm, r.dataset.sec); return; }
    const f = e.target.closest('[data-filter]'); if (f) { F.type = f.dataset.filter; $('#dbType').value = F.type; LIMIT = 120; renderCatalog(); $('#dbGrid').scrollTop = 0; }
  });
  document.querySelector('.dbtabs').onclick = e => { const b = e.target.closest('[data-dt]'); if (b) { TAB = b.dataset.dt; renderAll(); } };
  // vista ampliada en el catálogo y en la lista
  $('#deckb').addEventListener('mouseover', e => { const t = e.target.closest('.dbc,.dbr'); if (!t) return; clearTimeout(hpT); hpT = setTimeout(() => preview(t.dataset.code, e.clientX, e.clientY), 250); });
  $('#deckb').addEventListener('mouseout', e => { if (e.target.closest('.dbc,.dbr') && !e.relatedTarget?.closest?.('.dbc,.dbr')) { clearTimeout(hpT); $('#hoverprev').classList.remove('show'); } });

  // abrir un mazo compartido (#deck=…)
  const m = location.hash.match(/^#deck=([\w-]+)/);
  if (m) { const d = decodeDeck(m[1], 'shared'); if (d) { history.replaceState(null, '', location.pathname + location.search); showDecks(d); } }
}
