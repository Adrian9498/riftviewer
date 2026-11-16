// Tu colección de mazos:
// - "Mis mazos": galería con una tarjeta por mazo (arte de la leyenda, si cumple las reglas, precio, lo que te falta, récord),
//   con favoritos, carpetas y filtros por leyenda y dominio.
// - La página de un mazo: su lista visual, curva, revisión de reglas, costo, notas, récord de partidas e historial de versiones.
// El constructor (decks.js) queda para editar.
import { symbolHTML } from '../data/symbols';
import { money } from '../cloud/prices';
import { BATTLEFIELDS, MAIN_MIN, RUNES, validateDeck } from '../deck/rules';
import { mainWithChampion, total } from '../deck/model';
import { deckStats } from '../deck/stats';
import {
  HISTORY_MAX, NO_FOLDER, addResult, replayKey, cleanFolder, domainsIn, duplicate, emptyFilter, filterDecks, folders, games, legendsIn, versionSize, winRate,
} from '../deck/library';
import { $, ic } from './base';
import { IDB, cardByCode, deckCard } from './cards';
import { touchAsset } from './cloud-adapter';
import { go } from './nav';
import { replayMeta } from '../replay/meta';
import { REPLAY_FILE_PREFIX, REPLAY_FORMAT } from '../replay/decode';
import { deckCost } from './collection';
import { ago, openReplay, toast } from './shell';
import { closeModal, esc, openModal } from './utils';
import * as DB from './decks';
import { drawCard, handHTML, mulligan, newHand, pickHandCard } from './deckinsights';
import { analyzeText, backfill, insightsHTML, matchupsHTML, openCompare, recordHTML, restoreVersion, setSeen, showInsightsTab, swapCard } from './deckinsights';
import { fullRecord } from '../deck/analysis';

const DOMS = ['Fury', 'Calm', 'Mind', 'Body', 'Chaos', 'Order'];
const DOM_ES = { Fury: 'Furia', Calm: 'Calma', Mind: 'Mente', Body: 'Cuerpo', Chaos: 'Caos', Order: 'Orden' };
const TYPE_ES = { Unit: 'Unidades', Spell: 'Hechizos', Gear: 'Equipo' };
const sym = d => symbolHTML('rb_rune_' + d.toLowerCase()) || '';
const pct = x => Math.round(x * 100) + '%';
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const F = emptyFilter();

/** Lo que se muestra de cada mazo (depende del catálogo, los precios y tu colección). */
function infoOf(d) {
  const leg = d.legend && deckCard(d.legend);
  const issues = validateDeck(d, deckCard), errors = issues.filter(i => i.level === 'error').length;
  const c = deckCost(DB.deckCardsOf(d));
  return {
    legendName: leg?.name || '', doms: leg?.dom || [], img: (d.legend && cardByCode(d.legend)?.img) || '',
    n: total(mainWithChampion(d)), issues, errors,
    price: c ? c.cost : null, missN: c?.hasCollection ? c.missN : null, missCost: c?.missCost ?? null,
  };
}
const statusTag = (i, cls = 'dlst') => i.errors
  ? `<span class="${cls} no">${ic('x')} ${i.n < MAIN_MIN ? `Incompleto · ${i.n}/${MAIN_MIN}` : plural(i.errors, 'problema')}</span>`
  : `<span class="${cls} ok">${ic('check')} Listo para jugar</span>`;
const recordTag = r => games(r) ? `<span title="Victorias y derrotas">${ic('trophy')} ${r.w}-${r.l} · ${pct(winRate(r))}</span>` : '';

/* ================= galería ================= */
export function renderLib() {
  const all = DB.allDecks(), cache = new Map();
  const info = d => { if (!cache.has(d.id)) cache.set(d.id, infoOf(d)); return cache.get(d.id); };

  // carpetas
  const fl = folders(all), noF = all.filter(d => !cleanFolder(d.folder)).length;
  if (F.folder && F.folder !== NO_FOLDER && !fl.some(f => f.name === F.folder)) F.folder = '';
  if (F.folder === NO_FOLDER && !noF) F.folder = '';
  const fbtn = (v, label, n, icon) => `<button class="dlf${F.folder === v ? ' on' : ''}" data-folder="${esc(v)}">${ic(icon)}<span>${esc(label)}</span><small>${n}</small></button>`;
  const real = F.folder && F.folder !== NO_FOLDER;
  $('#dlSide').innerHTML = `<h4>Carpetas</h4>${fbtn('', 'Todos', all.length, 'cards')}${fl.map(f => fbtn(f.name, f.name, f.n, 'folder')).join('')}`
    + (fl.length && noF ? fbtn(NO_FOLDER, 'Sin carpeta', noF, 'dot') : '')
    + (real ? `<div class="dlfx"><button class="btn mini" data-frename>${ic('pen')} Renombrar</button><button class="btn mini danger" data-fdel>${ic('trash')} Borrar carpeta</button></div>` : '')
    + (!fl.length && all.length ? '<p class="dlhint">Para crear una carpeta, abre un mazo y pulsa "Mover a carpeta".</p>' : '');

  // leyendas y dominios que hay en tus mazos
  const legs = legendsIn(all, info);
  if (F.legend && !legs.some(l => l.name === F.legend)) F.legend = '';
  $('#dlLegend').innerHTML = '<option value="">Todas las leyendas</option>' + legs.map(l => `<option value="${esc(l.name)}">${esc(l.name)} (${l.n})</option>`).join('');
  $('#dlLegend').value = F.legend; $('#dlLegend').hidden = !legs.length;
  const doms = new Set(domainsIn(all, info));
  for (const x of [...F.dom]) if (!doms.has(x)) F.dom.delete(x);
  $('#dlDom').innerHTML = DOMS.filter(x => doms.has(x)).map(x => `<button class="chip${F.dom.has(x) ? ' on' : ''}" data-dom="${x}" title="${DOM_ES[x]}" aria-pressed="${F.dom.has(x)}">${sym(x)}</button>`).join('');
  $('#dlSort').value = F.sort;

  const list = filterDecks(all, F, info);
  $('#dlCount').textContent = all.length ? (list.length === all.length ? plural(all.length, 'mazo') : `${list.length} de ${all.length}`) : '';
  $('#dlGrid').innerHTML = !all.length
    ? `<div class="dlempty big">${ic('cards')}<b>Todavía no tienes mazos</b><span>Crea uno desde cero o importa una lista del simulador o un enlace de Riftviewer.</span>
        <div><button class="btn primary" data-new>${ic('plus')} Nuevo mazo</button><button class="btn" data-import>${ic('upload')} Importar</button></div></div>`
    : list.length ? list.map(d => tile(d, info(d))).join('')
    : `<div class="dlempty">Ningún mazo coincide con los filtros. <button class="btn mini" data-clear>Quitar filtros</button></div>`;
}
function tile(d, i) {
  const miss = i.missN == null ? '' : i.missN ? `<span class="miss" title="Cartas que no tienes en tu colección">faltan ${i.missN}</span>` : `<span class="have">${ic('check')} las tienes</span>`;
  return `<article class="dlc" data-id="${esc(d.id)}" tabindex="0" aria-label="${esc(d.name || 'Sin nombre')}">
    <div class="dlart"${i.img ? ` style="--img:url('${esc(i.img)}')"` : ''}>${statusTag(i)}
      <button class="dlfav${d.fav ? ' on' : ''}" data-fav="${esc(d.id)}" title="${d.fav ? 'Quitar de favoritos' : 'Marcar como favorito'}" aria-pressed="${!!d.fav}">${ic('star')}</button>
      <button class="dlfav dldel" data-del="${esc(d.id)}" title="Borrar este mazo" aria-label="Borrar ${esc(d.name || 'este mazo')}">${ic('trash')}</button></div>
    <div class="dlinfo">
      <b class="dlname">${esc(d.name || 'Sin nombre')}</b>
      <span class="dlleg">${i.doms.map(sym).join('')}<span>${esc(i.legendName || 'Sin leyenda')}</span></span>
      <div class="dlmeta"><span>${ic('cards')} ${i.n}/${MAIN_MIN}</span>${i.price != null ? `<span>${money(i.price)}</span>` : ''}${miss}${recordTag(fullRecord(d))}</div>
      <div class="dlfoot">${cleanFolder(d.folder) ? `<span class="dlfold">${ic('folder')}${esc(d.folder)}</span>` : '<span></span>'}<small>${ago(d.updatedAt || Date.now())}</small></div>
    </div></article>`;
}
const stored = id => DB.allDecks().find(d => d.id === id);
function toggleFav(id) { const d = stored(id); if (!d) return; d.fav = !d.fav; DB.writeDeck(d); renderLib(); }
/** Pregunta antes de borrar un mazo; `then` corre solo si se borró. */
function askDelete(d, then) {
  if (!d) return;
  openModal('Borrar mazo', `<p class="full">¿Borrar <b>${esc(d.name || 'Sin nombre')}</b>? Se borran también su récord, sus notas, su historial y sus repeticiones, y no se puede deshacer.</p>`,
    [['Cancelar'], ['Borrar', 'danger', () => { removeDeck(d); toast('Mazo borrado', 'ok'); then?.(); }]]);
}
function renameFolder(from) {
  openModal('Renombrar carpeta', `<label class="full">Nombre<input type="text" id="dlRenF" maxlength="40" value="${esc(from)}"></label>`,
    [['Cancelar'], ['Guardar', 'primary', () => {
      const to = cleanFolder($('#dlRenF').value); if (!to) { $('#dlRenF').focus(); return false; }
      for (const d of DB.allDecks()) if (cleanFolder(d.folder) === from) { d.folder = to; DB.writeDeck(d); }
      F.folder = to; renderLib(); toast(`Carpeta renombrada a "${to}"`, 'ok');
    }]]);
  const inp = $('#dlRenF'); inp.select();
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') document.querySelector('#modal .mfoot .btn.primary')?.click(); });
}
function renameDeck(d) {
  openModal('Cambiar nombre', `<label class="full">Nombre del mazo<input type="text" id="ddRen" maxlength="60" value="${esc(d.name || '')}"></label>`,
    [['Cancelar'], ['Guardar', 'primary', () => {
      const to = $('#ddRen').value.trim(); if (!to) { $('#ddRen').focus(); return false; }
      if (to !== d.name) { d.name = to; DB.writeDeck(d); renderDetail(); toast('Nombre cambiado', 'ok'); }
    }]]);
  const inp = $('#ddRen'); inp.select();
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') document.querySelector('#modal .mfoot .btn.primary')?.click(); });
}
function deleteFolder(name) {
  const decks = DB.allDecks().filter(d => cleanFolder(d.folder) === name);
  const done = msg => { F.folder = ''; renderLib(); toast(msg, 'ok'); };
  openModal('Borrar carpeta', `<p class="full">¿Qué hacemos con la carpeta <b>${esc(name)}</b> y sus ${plural(decks.length, 'mazo')}?</p>`, [
    ['Cancelar'],
    ['Borrar carpeta y mazos', 'danger', () => { for (const d of decks) removeDeck(d); done(`Borrados la carpeta y ${plural(decks.length, 'mazo')}`); }],
    ['Solo la carpeta', 'primary', () => { for (const d of decks) { delete d.folder; DB.writeDeck(d); } done('Carpeta borrada: sus mazos quedan sin carpeta'); }],
  ]);
}
function openDetail(id) { const d = stored(id); if (!d) return; DB.useDeck(d); DB.setView('detail'); $('#ddBody').scrollTop = 0; }

/* ================= página de un mazo ================= */
function cardTile(code, n) {
  const c = cardByCode(code), dc = deckCard(code);
  return `<div class="ddc" data-code="${esc(code)}" title="${esc(dc?.name || code)}" tabindex="0"><img src="${esc(c?.img || '')}" loading="lazy" alt="${esc(dc?.name || code)}">${n > 1 ? `<b>×${n}</b>` : ''}</div>`;
}
const byCost = (a, b) => (deckCard(a[0])?.e ?? 99) - (deckCard(b[0])?.e ?? 99) || (deckCard(a[0])?.name || '').localeCompare(deckCard(b[0])?.name || '');
function listHTML(d) {
  const sec = (title, n, body) => body ? `<section class="ddsec"><h3>${title}${n != null ? ` <small>${n}</small>` : ''}</h3><div class="ddgrid">${body}</div></section>` : '';
  const top = [d.legend, d.champion].filter(Boolean).map(c => cardTile(c, 1)).join('');
  const groups = { Unit: [], Spell: [], Gear: [], Otros: [] };
  Object.entries(d.main).sort(byCost).forEach(e => (groups[deckCard(e[0])?.type] || groups.Otros).push(e));
  const main = ['Unit', 'Spell', 'Gear', 'Otros'].filter(t => groups[t].length).map(t =>
    `<div class="ddtype">${TYPE_ES[t] || 'Otras'} <small>${groups[t].reduce((a, [, n]) => a + n, 0)}</small></div>${groups[t].map(([c, n]) => cardTile(c, n)).join('')}`).join('');
  const html = sec('Leyenda y campeón', null, top)
    + sec('Mazo principal', `${total(mainWithChampion(d))}/${MAIN_MIN}`, main)
    + sec('Campos de batalla', `${d.battlefields.length}/${BATTLEFIELDS}`, d.battlefields.map(b => cardTile(b, 1)).join(''))
    + sec('Runas', `${total(d.runes)}/${RUNES}`, Object.entries(d.runes).map(([c, n]) => cardTile(c, n)).join(''))
    + sec('Banquillo', total(d.side), Object.entries(d.side).sort(byCost).map(([c, n]) => cardTile(c, n)).join(''));
  return html || `<div class="dlempty big">${ic('cards')}<b>Este mazo está vacío</b><span>Pulsa <b>Editar</b> para agregar cartas.</span></div>`;
}
const kpi = (label, val, sub = '') => `<div class="ddkpi"><small>${label}</small><b>${val}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
function statsHTML(d) {
  if (!Object.keys(d.main).length && !d.champion) return '';
  const s = deckStats(d, deckCard), max = Math.max(1, ...s.curve);
  const mix = (obj, names) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span>${names[k] || k} <b>${n}</b></span>`).join('');
  return `<section class="ddbox"><h4>${ic('chart')} Curva de energía <small>promedio ${s.avgCost.toFixed(1)}</small></h4>
    <div class="dbcurve">${s.curve.map((n, k) => `<div><b>${n || ''}</b><i style="height:${(n / max) * 100}%"></i><span>${k === 7 ? '7+' : k}</span></div>`).join('')}</div>
    <div class="ddmix">${mix(s.types, TYPE_ES)}</div><div class="ddmix">${mix(s.domains, DOM_ES)}</div></section>`;
}
function checkHTML(issues) {
  return `<section class="ddbox"><h4>${ic('shield')} Revisión de reglas</h4>${issues.length
    ? issues.map(i => `<div class="dbiss ${i.level}">${ic(i.level === 'error' ? 'x' : 'help')}<span>${esc(i.msg)}${i.codes?.length ? `<small>${i.codes.map(c => esc(deckCard(c)?.name || c)).join(', ')}</small>` : ''}</span></div>`).join('')
    : `<div class="ddok">${ic('check')} Cumple todas las reglas</div>`}</section>`;
}
/* ---------- repeticiones de las partidas jugadas con el mazo ---------- */
const MAX_REPLAY = 10 * 1024 * 1024;   // lo que admite la nube por archivo
function repTile(r) {
  const ps = r.meta?.players || [];
  const art = ps.length
    ? `<div class="rart legs">${ps.slice(0, 2).map(p => { const u = (p.legendCode || p.legendName) ? cardByCode(p.legendCode, p.legendName)?.img || '' : ''; return `<span${u ? ` style="background-image:url('${esc(u)}')"` : ''}></span>`; }).join('')}</div>`
    : `<div class="rart">${ic('replay')}</div>`;
  const score = ps.length ? `<div class="rvs">${ps.map(p => `<span class="${p.winner ? 'win' : ''}">${p.winner ? ic('crown') : ''}${esc(p.name)} <b>${p.score}</b></span>`).join('<i>vs</i>')}</div>` : '';
  const a = r.analysis, sub = [a?.meName ? `jugaste como ${a.meName}` : '', r.meta?.turns ? plural(r.meta.turns, 'turno') : '', when(r.ts)].filter(Boolean).join(' · ');
  const res = a?.result ? `<button class="ddrt ${a.result}${r.count === false ? ' off' : ''}" data-repcount="${esc(r.id)}" aria-pressed="${r.count !== false}" title="${r.count === false ? 'No se cuenta en el récord: pulsa para contarla' : 'Se cuenta en el récord: pulsa para no contarla'}">${a.result === 'w' ? 'Victoria' : 'Derrota'}</button>` : '';
  return `<div class="rtile ddrep" data-rep="${esc(r.id)}" tabindex="0" title="Ver esta repetición">${art}
    <div class="rinfo"><b>${esc(ps.length ? ps.map(p => p.name).join(' vs ') : r.name)}</b>${score}<small>${esc(sub)}</small>${res}</div>
    <button class="rx" data-repdel="${esc(r.id)}" title="Quitar del mazo" aria-label="Quitar esta repetición del mazo">${ic('trash')}</button></div>`;
}
function replaysHTML(d) {
  const list = d.replays || [];
  return `<section class="ddbox"><h4>${ic('replay')} Repeticiones${list.length ? ` <small>${list.length}</small>` : ''}</h4>
    ${list.length ? `<div class="ddreps">${list.map(repTile).join('')}</div>`
      : '<p class="dlhint">Sube los replays (.json) de las partidas que jugaste con este mazo y ábrelos con un clic. También puedes soltarlos sobre esta página.</p>'}
    <button class="btn mini" data-repadd>${ic('upload')} Subir repeticiones</button></section>`;
}
/** Guarda los replays en el mazo: el archivo en IndexedDB (y en la nube), el resumen en el mazo. */
export async function addReplays(files) {
  const d = DB.currentDeck(); if (!d || DB.isShared() || !files.length) return 0;
  let ok = 0;
  for (const f of files) {
    let text, j;
    try { text = await f.text(); j = JSON.parse(text); } catch (e) { j = null; }
    if (j?.format !== REPLAY_FORMAT) { toast(`"${f.name}" no es un replay del simulador`, 'err'); continue; }
    if (text.length > MAX_REPLAY) { toast(`"${f.name}" pesa más de 10 MB`, 'err'); continue; }
    const name = f.name.replace(/\.json$/i, '').replace(REPLAY_FILE_PREFIX, 'Replay ');
    if ((d.replays || []).some(r => r.name === name && r.size === text.length)) { toast(`"${name}" ya está en este mazo`); continue; }
    let meta = null; try { meta = replayMeta(j); } catch (e) {}
    const analysis = analyzeText(text, d.legend);
    const id = newId(), key = replayKey(d.id, id);
    try { await IDB.set(key, text); } catch (e) { toast('No hay espacio para guardar la repetición', 'err'); continue; }
    touchAsset(key);
    d.replays = [{ id, name, ts: Date.now(), size: text.length, meta, ...(analysis ? { analysis } : {}) }, ...(d.replays || [])];
    ok++;
  }
  if (ok) {
    DB.writeDeck(d);
    if (DB.currentDeck() === d) renderDetail();
    toast(ok === 1 ? 'Repetición guardada en el mazo' : `${ok} repeticiones guardadas en el mazo`, 'ok');
  }
  return ok;
}
function pickReplays() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json'; inp.multiple = true;
  inp.onchange = () => addReplays([...inp.files]);
  inp.click();
}
async function openDeckReplay(rid) {
  const d = DB.currentDeck(), r = d?.replays?.find(x => x.id === rid); if (!r) return;
  const text = await IDB.get(replayKey(d.id, rid)).catch(() => null);
  if (typeof text !== 'string') { toast('Esta repetición todavía no llega a este dispositivo. Espera a que se sincronice e inténtalo de nuevo.', 'err'); return; }
  let j; try { j = JSON.parse(text); } catch (e) { toast('El archivo de esta repetición está dañado', 'err'); return; }
  if (openReplay(j, r.name, text)) go('partida');
}
const dropReplayFile = (deckId, id) => { const key = replayKey(deckId, id); IDB.del(key).catch(() => {}); touchAsset(key, true); };
function removeReplay(rid) {
  const d = DB.currentDeck(), r = d?.replays?.find(x => x.id === rid); if (!r) return;
  openModal('Quitar repetición', `<p class="full">¿Quitar <b>${esc(r.name)}</b> de este mazo? Se borra el archivo guardado aquí.</p>`,
    [['Cancelar'], ['Quitar', 'danger', () => {
      dropReplayFile(d.id, rid); d.replays = d.replays.filter(x => x.id !== rid); DB.writeDeck(d); renderDetail(); toast('Repetición quitada', 'ok');
    }]]);
}
/** Borra un mazo junto con los archivos de sus repeticiones. */
function removeDeck(d) { for (const r of d.replays || []) dropReplayFile(d.id, r.id); DB.deleteDeck(d.id); }

const when = ts => new Date(ts).toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
function changes(r, sign) {
  return Object.entries(r).sort((a, b) => b[1] - a[1]).map(([k, n]) => {
    const side = k.startsWith('side:'), code = side ? k.slice(5) : k;
    return `<div class="${sign === '+' ? 'add' : 'rm'}"><b>${sign}${n}</b> ${esc(deckCard(code)?.name || code)}${side ? ' <small>(banquillo)</small>' : ''}</div>`;
  }).join('');
}
function historyHTML(d) {
  const h = d.history || [];
  return `<section class="ddbox"><h4>${ic('book')} Historial <small>${plural(h.length, 'versión', 'versiones')}</small></h4>${h.length
    ? `<ol class="ddhist">${h.map((v, k) => { const s = versionSize(v), first = k === h.length - 1 && h.length < HISTORY_MAX;
      return `<li><details${k === 0 ? ' open' : ''}><summary><span><b>${first ? 'Primera versión' : `Versión ${h.length - k}`}</b><small>${when(v.ts)}</small></span>
        ${s.added ? `<em class="add">+${s.added}</em>` : ''}${s.removed ? `<em class="rm">−${s.removed}</em>` : ''}</summary>
        <div class="ddchg">${changes(v.add, '+')}${changes(v.rm, '−')}</div>${k > 0 ? `<button class="btn mini" data-restore="${k}">${ic('replay')} Volver a esta versión</button>` : ''}</details></li>`; }).join('')}</ol>`
    : '<p class="dlhint">Cada vez que termines de editar este mazo se guardará qué cartas entraron y salieron.</p>'}</section>`;
}
export function renderDetail() {
  const d = DB.currentDeck(), shared = DB.isShared();
  if (!d) { DB.setView('lib'); return; }
  const i = infoOf(d), champ = d.champion && deckCard(d.champion), r = fullRecord(d);
  $('#ddSave').hidden = !shared; $('#ddDup').hidden = shared; $('#ddDel').hidden = shared;
  const own = i.missN == null ? '' : kpi('Te faltan', i.missN ? String(i.missN) : '0',
    i.missN ? `${i.missCost != null ? money(i.missCost) + ' · ' : ''}<button class="lnk" data-missing>Ver la lista</button>` : 'Tienes todas sus cartas');
  $('#ddBody').innerHTML = `
    <section class="ddhero"${i.img ? ` style="--img:url('${esc(i.img)}')"` : ''}>
      ${i.img ? `<div class="ddleg ddc" data-code="${esc(d.legend)}"><img src="${esc(i.img)}" alt="${esc(i.legendName)}"></div>` : `<div class="ddleg none">${ic('cards')}</div>`}
      <div class="ddhead">
        <div class="ddtags">${statusTag(i, 'ddst')}${cleanFolder(d.folder) ? `<span class="dlfold">${ic('folder')}${esc(d.folder)}</span>` : ''}${shared ? '<span class="ddshared">Compartido · todavía no está en tus mazos</span>' : ''}</div>
        <h1>${esc(d.name || 'Sin nombre')}${shared ? '' : `<button class="ddren" data-rename title="Cambiar nombre" aria-label="Cambiar nombre">${ic('pen')}</button>`}</h1>
        <div class="ddsub">${i.doms.map(sym).join('')}<span>${esc(i.legendName || 'Sin leyenda')}${champ ? ` · campeón: ${esc(champ.name)}` : ''}</span></div>
        ${shared ? '' : `<div class="ddacts"><button class="btn mini${d.fav ? ' on' : ''}" data-fav aria-pressed="${!!d.fav}">${ic('star')} ${d.fav ? 'Favorito' : 'Marcar favorito'}</button>
          <button class="btn mini" data-move>${ic('folder')} ${cleanFolder(d.folder) ? 'Cambiar de carpeta' : 'Mover a carpeta'}</button>
          <button class="btn mini" data-compare>${ic('flip')} Comparar con otro mazo</button>
          ${d.updatedAt ? `<small>Editado ${ago(d.updatedAt)}</small>` : ''}</div>`}
        <div class="ddkpis">
          ${kpi('Cartas', `${i.n}/${MAIN_MIN}`, `${total(d.runes)}/${RUNES} runas · ${d.battlefields.length}/${BATTLEFIELDS} campos`)}
          ${kpi('Precio', i.price != null ? '~' + money(i.price) : '—', i.price != null ? 'TCGplayer, versión más barata' : 'Sin precios todavía')}
          ${own}
          ${shared ? '' : kpi('Récord', games(r) ? `${r.w}-${r.l}` : '—', games(r) ? `${pct(winRate(r))} de victorias` : 'Sin partidas anotadas')}
        </div>
      </div>
    </section>
    <div class="ddcols">
      <div class="ddmain">${insightsHTML(d, shared, listHTML(d), total(mainWithChampion(d)) || '')}</div>
      <aside class="ddside">
        ${shared ? '' : recordHTML(d)}
        ${shared ? '' : replaysHTML(d)}
        ${shared ? '' : matchupsHTML(d)}
        ${shared ? (d.notes ? `<section class="ddbox"><h4>${ic('note')} Notas</h4><p class="ddnotes">${esc(d.notes)}</p></section>` : '')
          : `<section class="ddbox"><h4>${ic('note')} Notas</h4><textarea id="ddNotes" rows="5" maxlength="4000" placeholder="Plan de juego, mulligans, cambios contra ciertos mazos…">${esc(d.notes || '')}</textarea></section>`}
        ${statsHTML(d)}
        ${checkHTML(i.issues)}
        ${shared ? '' : historyHTML(d)}
      </aside>
    </div>
    <p class="credits">Datos e imágenes de cartas: <a href="https://riftcodex.com" target="_blank" rel="noopener">Riftcodex</a> y <a href="https://openrift.app" target="_blank" rel="noopener">OpenRift</a> · precios: TCGplayer vía <a href="https://tcgcsv.com" target="_blank" rel="noopener">TCGCSV</a>. Riftbound es una marca de Riot Games; Riftviewer no está afiliado a Riot Games.</p>`;
  if (!shared) backfill(d, renderDetail);
}

/* ---------- acciones de la página ---------- */
function openMove(d) {
  const fl = folders(DB.allDecks()), cur = cleanFolder(d.folder);
  const set = f => { d.folder = cleanFolder(f) || undefined; DB.writeDeck(d); renderDetail(); toast(d.folder ? `Movido a "${d.folder}"` : 'Sacado de la carpeta', 'ok'); };
  const body = openModal('Mover a carpeta', `
    ${fl.length ? `<div class="full dlmove">${fl.map(f => `<button class="btn${f.name === cur ? ' primary' : ''}" data-f="${esc(f.name)}">${ic('folder')} ${esc(f.name)} <small>${f.n}</small></button>`).join('')}
      ${cur ? `<button class="btn ghost" data-f="">${ic('x')} Sacar de la carpeta</button>` : ''}</div>` : ''}
    <label class="full">Carpeta nueva<input type="text" id="dlNewF" maxlength="40" placeholder="Por ejemplo: Torneo, Casual, En prueba"></label>`,
    [['Cancelar'], ['Crear y mover', 'primary', () => { const v = cleanFolder($('#dlNewF').value); if (!v) { $('#dlNewF').focus(); return false; } set(v); }]]);
  body.querySelector('.dlmove')?.addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { closeModal(); set(b.dataset.f); } });
  $('#dlNewF').addEventListener('keydown', e => { if (e.key === 'Enter') { const v = cleanFolder(e.target.value); if (v) { closeModal(); set(v); } } });
}
/** En el teléfono no hay "pasar el ratón": al tocar una carta se ve en grande. */
function showCard(code) {
  const c = cardByCode(code); if (!c) return;
  openModal(c.name, `<div class="full ddbig"><img src="${esc(c.img)}" alt="${esc(c.name)}"></div>`, [['Cerrar', 'primary']]);
}
let notesT = null;

export function initLib() {
  // galería
  $('#dlNew').onclick = () => DB.newDeck();
  $('#dlImport').onclick = () => DB.openImport();
  $('#dlQ').addEventListener('input', e => { F.q = e.target.value; renderLib(); });
  $('#dlLegend').onchange = e => { F.legend = e.target.value; renderLib(); };
  $('#dlSort').onchange = e => { F.sort = e.target.value; renderLib(); };
  $('#dlDom').onclick = e => { const b = e.target.closest('[data-dom]'); if (!b) return; F.dom.has(b.dataset.dom) ? F.dom.delete(b.dataset.dom) : F.dom.add(b.dataset.dom); renderLib(); };
  $('#dlSide').onclick = e => {
    if (e.target.closest('[data-frename]')) { renameFolder(F.folder); return; }
    if (e.target.closest('[data-fdel]')) { deleteFolder(F.folder); return; }
    const b = e.target.closest('[data-folder]'); if (b) { F.folder = b.dataset.folder; renderLib(); }
  };
  $('#dlGrid').addEventListener('click', e => {
    const fav = e.target.closest('[data-fav]'); if (fav) { toggleFav(fav.dataset.fav); return; }
    const del = e.target.closest('[data-del]'); if (del) { askDelete(stored(del.dataset.del), renderLib); return; }
    if (e.target.closest('[data-new]')) { DB.newDeck(); return; }
    if (e.target.closest('[data-import]')) { DB.openImport(); return; }
    if (e.target.closest('[data-clear]')) { Object.assign(F, emptyFilter(), { sort: F.sort }); $('#dlQ').value = ''; renderLib(); return; }
    const t = e.target.closest('.dlc'); if (t) openDetail(t.dataset.id);
  });
  $('#dlGrid').addEventListener('keydown', e => { const t = e.target.closest('.dlc'); if (t && (e.key === 'Enter' || e.key === ' ') && e.target === t) { e.preventDefault(); openDetail(t.dataset.id); } });

  // página del mazo
  $('#ddBack').onclick = () => DB.setView('lib');
  $('#ddEdit').onclick = () => DB.editDeck();
  $('#ddShare').onclick = () => DB.openShare();
  $('#ddExport').onclick = () => DB.openExport();
  $('#ddImage').onclick = () => DB.exportImage();
  $('#ddSave').onclick = () => DB.saveShared();
  $('#ddDup').onclick = () => {
    const c = duplicate(DB.currentDeck(), newId());
    DB.writeDeck(c); DB.useDeck(c); DB.setView('detail'); toast('Copia creada: ya estás en ella', 'ok');
  };
  $('#ddDel').onclick = () => {
    askDelete(DB.currentDeck(), () => DB.setView('lib'));
  };
  const body = $('#ddBody');
  body.addEventListener('click', e => {
    const d = DB.currentDeck(); if (!d) return;
    if (e.target.closest('[data-missing]')) { DB.openMissing(); return; }
    if (e.target.closest('[data-fav]')) { d.fav = !d.fav; DB.writeDeck(d); renderDetail(); return; }
    if (e.target.closest('[data-move]')) { openMove(d); return; }
    if (e.target.closest('[data-repadd]')) { pickReplays(); return; }
    if (e.target.closest('[data-compare]')) { openCompare(d); return; }
    const tab = e.target.closest('[data-instab]'); if (tab) { showInsightsTab(body, tab.dataset.instab); return; }
    if (e.target.closest('[data-rename]')) { renameDeck(d); return; }
    // mano de prueba: se redibuja solo su panel
    const ha = e.target.closest('[data-hand]'), hc = e.target.closest('[data-hcard]');
    if (ha || hc) {
      if (hc) pickHandCard(+hc.dataset.hcard);
      else ({ new: () => newHand(d), mull: mulligan, draw: drawCard })[ha.dataset.hand]?.();
      const box = $('#ddHand'); if (box) box.outerHTML = handHTML(d);
      return;
    }
    const cnt = e.target.closest('[data-repcount]');
    if (cnt) { const r = d.replays?.find(x => x.id === cnt.dataset.repcount); if (r) { r.count = r.count === false; DB.writeDeck(d); renderDetail(); } return; }
    const sw = e.target.closest('[data-swap]'); if (sw) { swapCard(d, sw.dataset.swap, sw.dataset.to); renderDetail(); return; }
    const rs = e.target.closest('[data-restore]'); if (rs) { restoreVersion(d, +rs.dataset.restore, renderDetail); return; }
    const rdel = e.target.closest('[data-repdel]'); if (rdel) { removeReplay(rdel.dataset.repdel); return; }
    const rep = e.target.closest('[data-rep]'); if (rep) { openDeckReplay(rep.dataset.rep); return; }
    const res = e.target.closest('[data-res]');
    if (res) { addResult(d, res.dataset.res, +res.dataset.delta); DB.writeDeck(d); renderDetail(); return; }
    const c = e.target.closest('.ddc'); if (c && !DB.hasHover()) showCard(c.dataset.code);
  });
  body.addEventListener('input', e => {
    if (e.target.id !== 'ddNotes') return;
    const d = DB.currentDeck(); if (!d || DB.isShared()) return;
    d.notes = e.target.value; clearTimeout(notesT); notesT = setTimeout(() => DB.writeDeck(d), 400);
  });
  // si se sale de la página con una nota a medio guardar
  body.addEventListener('focusout', e => { if (e.target.id === 'ddNotes' && notesT) { clearTimeout(notesT); notesT = null; const d = DB.currentDeck(); if (d && !DB.isShared()) DB.writeDeck(d); } });
  body.addEventListener('change', e => { if (e.target.id === 'ddSeen') { setSeen(+e.target.value); renderDetail(); } });
  // flechas para moverse entre las pestañas del análisis
  body.addEventListener('keydown', e => {
    const t = e.target.closest?.('[data-instab]'); if (!t || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    const all = [...t.parentElement.querySelectorAll('[data-instab]')], n = all[(all.indexOf(t) + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
    e.preventDefault(); showInsightsTab(body, n.dataset.instab); n.focus();
  });
  body.addEventListener('keydown', e => { const r = e.target.closest?.('[data-rep]'); if (r && e.target === r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDeckReplay(r.dataset.rep); } });
  // soltar replays sobre la página de un mazo los guarda en él (en lugar de abrirlos como partida)
  body.addEventListener('drop', e => {
    const files = [...(e.dataTransfer?.files || [])].filter(f => /\.json$/i.test(f.name));
    if (!files.length || !DB.currentDeck() || DB.isShared()) return;
    e.preventDefault(); addReplays(files);
  });
}
