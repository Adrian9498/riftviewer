// Mi colección: cuántas copias tienes de cada impresión y acabado, con el progreso de cada set.
// Se guarda como un proyecto más ("rb_proj_coll:mine"), así se sincroniza con tu cuenta como los mazos.
// Las impresiones salen del catálogo de OpenRift (public/openrift-catalog.json).
import { locale } from '../i18n/i18n';
import { noteLocalChange } from '../cloud/sync';
import { FINISH_ES, buildPrintings, bump, collectionText, countOf, emptyCollection, pct, setProgress, variantsOf } from '../collection/model';
import { deckNeeds, needsSummary } from '../collection/needs';
import { norm } from '../data/text';
import { collectionValue, collectionValueHistory, historyPoints, latestPrices, money, priceHistory, priceOf, pricesNow, tcgplayerUrl, valuePoints } from '../cloud/prices';
import { $, ic } from './base';
import { orCatalog } from './cards';
import { openScanner, releaseScanner, warmScanner } from './scanner';
import { DOC, toast } from './shell';
import { esc, openModal } from './utils';

const KEY = 'rb_proj_coll:mine';
let CAT = null;          // { prints, sets, byCode }
let COL = null;
let SET = '';
const F = { q: '', own: '', v: 'all', rar: '', sort: 'num' };
let LIMIT = 240;
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };

/* ---------- datos ---------- */
export function catalog() {
  if (!CAT) { const raw = orCatalog(); if (!raw) return null; const b = buildPrintings(raw); CAT = { ...b, byCode: new Map(b.prints.map(p => [p.code, p])) }; }
  return CAT;
}
function load() {
  bumpRev();
  try {
    const d = JSON.parse(ls(KEY) || 'null');
    COL = d && !d.deleted && d.items ? { id: 'mine', items: d.items, updatedAt: d.updatedAt || d.ts || 0 } : emptyCollection();
  } catch (e) { COL = emptyCollection(); }
}
export function collection() { if (!COL) load(); return COL; }
let saveT = null, dirty = false;
function save() {
  clearTimeout(saveT); dirty = true;
  saveT = setTimeout(() => { dirty = false; ls(KEY, JSON.stringify({ ...COL, ts: Date.now() })); noteLocalChange('projects'); }, 400);
}
/** suma (o quita) copias de un acabado y refresca la pantalla; también lo usa el escáner */
export function addCopies(code, finish, d) {
  const n = bump(collection(), code, finish, d); save(); bumpRev();
  document.dispatchEvent(new Event('rb:collection'));
  if (!$('#collb').hidden) { refreshTile(code); renderSets(); renderHead(); renderTotal(); }
  return n;
}
const mainFinish = p => p.finishes.includes('normal') ? 'normal' : p.finishes[0];
function quickRemove(p) {
  const row = collection().items[p.code]; if (!row) return;
  const f = row[mainFinish(p)] ? mainFinish(p) : Object.keys(row)[0];
  addCopies(p.code, f, -1);
}

/* ---------- tu colección en los mazos ----------
   Para jugar sirve cualquier versión, así que se cuenta por nombre de carta.
   riftcodex escribe las leyendas "Ekko - Boy Who Shattered Time" y el constructor "Ekko, Boy…" para las de OpenRift;
   en OpenRift la carta se llama solo "Boy Who Shattered Time". Por eso primero se busca el código en el catálogo. */
export const nameKey = n => norm(String(n || '').split(' - ').pop());
const keyOf = c => nameKey(catalog()?.byCode.get(String(c.code || '').toUpperCase())?.name || c.name);
let NAMES = null, OWNED = null, REV = 0;
const bumpRev = () => { REV++; OWNED = null; };
/** Copias tuyas por nombre de carta (todas las versiones y acabados juntos). */
function ownedMap() {
  const cat = catalog(); if (!cat) return new Map();
  if (OWNED && OWNED.cat === cat && OWNED.rev === REV) return OWNED.map;
  const map = new Map();
  for (const [code, row] of Object.entries(collection().items)) {
    const p = cat.byCode.get(code); if (!p) continue;
    const k = nameKey(p.name); map.set(k, (map.get(k) || 0) + Object.values(row).reduce((a, b) => a + b, 0));
  }
  OWNED = { cat, rev: REV, map };
  return map;
}
export const hasCollection = () => Object.keys(collection().items).length > 0;
/** Cuántas copias tienes de una carta del constructor (cualquier versión). */
export const ownedOf = card => card ? ownedMap().get(keyOf(card)) || 0 : 0;
/** Precio de la versión más barata con ese nombre (normal o foil). */
function cheapest(c, k) {
  const prices = pricesNow(), cat = catalog(); if (!prices || !cat) return null;
  if (!NAMES || NAMES.cat !== cat) { NAMES = { cat, by: new Map() }; for (const p of cat.prints) { const nk = nameKey(p.name); if (!NAMES.by.has(nk)) NAMES.by.set(nk, []); NAMES.by.get(nk).push(p.code); } }
  const ps = [c.code, ...(NAMES.by.get(k) || [])].flatMap(code => [priceOf(prices, code, 'normal'), priceOf(prices, code, 'foil')]).filter(x => x != null);
  return ps.length ? Math.min(...ps) : null;
}
/** Cada carta del mazo con las que tienes, las que faltan y su precio. cards: [{ code, name, n }] */
export const deckNeedsFor = cards => deckNeeds(cards, ownedMap(), keyOf, cheapest);
/**
 * Costo aproximado de un mazo en TCGplayer: cada carta a la impresión más barata con su nombre.
 * Con tu colección, también cuántas te faltan y cuánto cuestan. null si aún no hay precios o catálogo.
 */
export function deckCost(cards) {
  if (!pricesNow() || !catalog()) return null;
  return { ...needsSummary(deckNeedsFor(cards)), hasCollection: hasCollection() };
}

/* ---------- pantalla ---------- */
function renderTotal() {
  const items = Object.values(collection().items), copies = items.reduce((a, r) => a + Object.values(r).reduce((x, y) => x + y, 0), 0);
  const val = pricesNow() ? collectionValue(pricesNow(), collection().items).value : 0;
  // tarjeta de arriba: cuánto vale todo lo que tienes y un botón grande a la gráfica de su valor
  const el = $('#coSum');
  el.hidden = !copies;
  if (!copies) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="cosv"><small>Tu colección vale</small><b>${val ? money(val) : '—'}</b>
      <span>${copies} carta${copies === 1 ? '' : 's'} · ${items.length} distinta${items.length === 1 ? '' : 's'}${val ? '' : ' · sin precios todavía'}</span></div>
    ${val ? `<button class="btn primary" data-value>${ic('chart')} <span>Ver su valor en el tiempo</span></button>` : ''}`;
  el.classList.toggle('click', !!val);
}
function renderSets() {
  const cat = catalog(); if (!cat) return;
  const row = s => {
    const pr = setProgress(cat.prints, collection(), s.code), p = pct(pr.base.total ? pr.base : pr.all);
    return `<button class="coset${s.code === SET ? ' on' : ''}" data-set="${s.code}">
      <span class="cosn"><b>${esc(s.name)}</b><small>${s.code}</small></span>
      <span class="cobar"><i style="width:${p}%"></i></span>
      <span class="cosp"><span>${pr.base.total ? `${pr.base.have}/${pr.base.total}` : `${pr.all.have}/${pr.all.total}`}</span><b>${p}%</b></span></button>`;
  };
  const main = cat.sets.filter(s => s.main), other = cat.sets.filter(s => !s.main);
  $('#coSets').innerHTML = `<h4>Sets</h4>${main.map(row).join('')}${other.length ? `<h4>Otros productos</h4>${other.map(row).join('')}` : ''}`;
}
function renderHead() {
  const cat = catalog(); if (!cat) return;
  const s = cat.sets.find(x => x.code === SET); if (!s) { $('#coHead').innerHTML = ''; return; }
  const pr = setProgress(cat.prints, collection(), SET), miss = pr.base.total - pr.base.have;
  const inSet = Object.fromEntries(Object.entries(collection().items).filter(([c]) => cat.byCode.get(c)?.set === SET));
  const val = pricesNow() ? collectionValue(pricesNow(), inSet).value : 0;
  const ring = (p, label, sub) => `<div class="coring" style="--p:${pct(p)}"><span><b>${pct(p)}%</b><small>${label}</small></span><em>${sub}</em></div>`;
  $('#coHead').innerHTML = `
    <div class="cohinfo"><h2>${esc(s.name)}</h2><small>${s.code}${s.date ? ' · ' + new Date(s.date + 'T12:00').toLocaleDateString(locale(), { month: 'long', year: 'numeric' }) : ''} · ${pr.copies} copia${pr.copies === 1 ? '' : 's'} en total${val ? ` · <b class="coval">vale ${money(val)}</b>` : ''}</small>
      ${pr.base.total && miss ? `<button class="btn mini" data-misses>${ic('target')} Ver las ${miss} que me faltan</button>` : pr.base.total ? '<span class="codone">¡Set base completo!</span>' : ''}</div>
    ${pr.base.total ? ring(pr.base, 'set base', `${pr.base.have} de ${pr.base.total}`) : ''}
    ${ring(pr.all, 'con versiones', `${pr.all.have} de ${pr.all.total}`)}`;
}
function visible() {
  const cat = catalog(); if (!cat) return [];
  const q = norm(F.q.trim()), qn = F.q.trim().replace(/^0+/, '');
  const out = cat.prints.filter(p => {
    if (p.set !== SET) return false;
    if (F.v === 'base' && !p.base) return false;
    if (F.v === 'alt' && p.base) return false;
    if (F.rar && p.rarity !== F.rar) return false;
    if (q && !norm(p.name).includes(q) && String(p.num) !== qn && !p.code.includes(F.q.trim().toUpperCase())) return false;
    const n = countOf(collection(), p.code);
    if (F.own === 'have' && !n) return false;
    if (F.own === 'miss' && n) return false;
    return true;
  });
  // más valiosas: por el precio más alto entre sus acabados
  if (F.sort === 'price') { const pv = p => Math.max(...p.finishes.map(f => priceOf(pricesNow(), p.code, f) ?? -1)); out.sort((a, b) => pv(b) - pv(a)); }
  return out;
}
function tileHTML(p) {
  const row = collection().items[p.code] || {}, n = Object.values(row).reduce((a, b) => a + b, 0), shiny = Object.keys(row).some(f => f !== 'normal');
  const num = (p.prefix || '') + String(p.num).padStart(p.prefix ? 2 : 3, '0') + p.suffix.toLowerCase();
  const pf = n && row.foil && !row.normal ? 'foil' : mainFinish(p), pr = priceOf(pricesNow(), p.code, pf) ?? priceOf(pricesNow(), p.code, p.finishes.find(f => f !== pf) || pf);
  return `<div class="dbc coc${n ? ' in' : ' miss'}" data-code="${p.code}" title="${esc(p.name)} · ${p.code}${p.variant !== 'Normal' ? ' · ' + p.variant : ''}">
    <img loading="lazy" src="${esc(p.img)}" alt="">
    <span class="conum">${num}${p.total && !p.prefix ? `<small>/${p.total}</small>` : ''}</span>
    ${pr != null ? `<span class="copr">${money(pr)}</span>` : ''}
    ${n ? `<span class="dbn">${n}</span>` : ''}${shiny ? '<span class="cofoil" title="Tienes copias foil o metal">✦</span>' : ''}
    <div class="dbcb"><button class="btn" data-co="-" title="Quitar una">−</button><button class="btn" data-co="+" title="Sumar una ${FINISH_ES[mainFinish(p)].toLowerCase()}">+</button></div></div>`;
}
function renderGrid() {
  const cat = catalog();
  if (!cat) { $('#coGrid').innerHTML = '<div class="dbempty">Cargando el catálogo de cartas…</div>'; $('#coCount').textContent = ''; return; }
  const list = visible();
  $('#coCount').textContent = `${list.length} carta${list.length === 1 ? '' : 's'}`;
  $('#coGrid').innerHTML = list.length ? list.slice(0, LIMIT).map(tileHTML).join('') + (list.length > LIMIT ? `<button class="btn dbmore" data-more>Mostrar más (${list.length - LIMIT})</button>` : '')
    : `<div class="dbempty">${F.own === 'miss' ? '¡No te falta ninguna con estos filtros!' : F.own === 'have' ? 'Todavía no tienes cartas aquí. Usa <b>Escanear cartas</b> o el botón <b>+</b>.' : 'No hay cartas con estos filtros.'}</div>`;
}
function refreshTile(code) {
  const el = $('#coGrid').querySelector(`[data-code="${CSS.escape(code)}"]`), p = catalog()?.byCode.get(code); if (!el || !p) return;
  el.outerHTML = tileHTML(p);
}
function renderAll() {
  const cat = catalog();
  if (cat && !cat.sets.some(s => s.code === SET)) SET = cat.sets.find(s => s.main)?.code || cat.sets[0]?.code || '';
  renderTotal(); renderSets(); renderHead(); renderGrid();
}

/* ---------- detalle de una carta: acabados y otras versiones ---------- */
function cardBody(p) {
  const row = collection().items[p.code] || {}, vars = variantsOf(catalog().prints, p);
  return `<div class="codet"><img src="${esc(p.img)}" alt="">
    <div class="codeti"><b>${esc(p.name)}</b><small>${p.code} · ${p.rarity}${p.variant !== 'Normal' ? ' · ' + p.variant : ''}</small>
      <div class="cofins">${p.finishes.map(f => `<div class="cofin"><span>${FINISH_ES[f] || f}${priceOf(pricesNow(), p.code, f) != null ? ` <em>${money(priceOf(pricesNow(), p.code, f))}</em>` : ''}</span>
        <button class="btn ico" data-df="${f}" data-d="-1" ${row[f] ? '' : 'disabled'}>−</button><b>${row[f] || 0}</b><button class="btn ico" data-df="${f}" data-d="1">+</button></div>`).join('')}</div>
      ${pricesNow() ? `<div class="dbsub">Precio en TCGplayer (EE. UU.) <small class="pvia">vía <a href="https://tcgcsv.com" target="_blank" rel="noopener">TCGCSV</a></small></div><div class="cohist" data-hist="${p.code}"><div class="cohc">Cargando historial…</div></div>${tcgplayerUrl(pricesNow(), p.code) ? `<a class="btn mini" href="${tcgplayerUrl(pricesNow(), p.code)}" target="_blank" rel="noopener">Ver en TCGplayer ↗</a>` : ''}` : ''}
      ${vars.length > 1 ? `<div class="dbsub">Otras versiones</div><div class="covars">${vars.map(v => `<button class="covar${v.code === p.code ? ' on' : ''}" data-dv="${v.code}" title="${v.code} · ${v.variant}"><img src="${esc(v.img)}" alt=""><small>${v.variant}</small>${countOf(collection(), v.code) ? `<span class="dbn">${countOf(collection(), v.code)}</span>` : ''}</button>`).join('')}</div>` : ''}
    </div></div>`;
}
function openCard(code) {
  let p = catalog()?.byCode.get(code); if (!p) return;
  const body = openModal(p.name, '', [['Listo', 'primary']]);
  const wrap = document.createElement('div'); wrap.className = 'full'; body.appendChild(wrap);
  let hf = null;   // acabado de la gráfica
  const paint = () => {
    wrap.innerHTML = cardBody(p); body.closest('#modal').querySelector('h2').textContent = p.name;
    const box = wrap.querySelector('[data-hist]'); if (!box) return;
    const want = p.code;
    hf = p.finishes.includes(hf) ? hf : (priceOf(pricesNow(), p.code, 'normal') != null ? 'normal' : 'foil');
    priceHistory(p.code).then(rows => { if (p.code === want && box.isConnected) drawHistory(box, rows, p, hf, f => { hf = f; drawHistory(box, rows, p, hf); }); });
  };
  wrap.addEventListener('click', e => {
    const b = e.target.closest('[data-df]'); if (b) { addCopies(p.code, b.dataset.df, +b.dataset.d); paint(); return; }
    const v = e.target.closest('[data-dv]'); if (v) { p = catalog().byCode.get(v.dataset.dv); paint(); }
  });
  paint();
}

/* ---------- historial de precio ----------
   Una sola serie (el acabado elegido): línea de 2 px, área tenue, eje sin rejilla, y al pasar el ratón
   una guía vertical con el precio y la fecha de ese día. */
/**
 * Gráfica de línea con el valor del último día, el cambio desde el primero y un tooltip al pasar el ratón.
 * pts: [{ day: 'YYYY-MM-DD', v }] (dos o más). before: lo que va arriba (botones). aria: descripción para lectores de pantalla.
 */
function lineChart(box, pts, aria, before = '') {
  const W = 520, H = 150, L = 46, R = 10, T = 12, B = 22;
  const vs = pts.map(x => x.v), lo = Math.min(...vs), hi = Math.max(...vs), pad = (hi - lo) * 0.12 || hi * 0.1 || 1;
  const y0 = Math.max(0, lo - pad), y1 = hi + pad;
  const t0 = +new Date(pts[0].day), t1 = +new Date(pts[pts.length - 1].day);
  const X = d => L + (W - L - R) * ((+new Date(d) - t0) / (t1 - t0 || 1)), Y = v => T + (H - T - B) * (1 - (v - y0) / (y1 - y0));
  const line = pts.map((q, i) => `${i ? 'L' : 'M'}${X(q.day).toFixed(1)},${Y(q.v).toFixed(1)}`).join('');
  const area = `${line}L${X(pts[pts.length - 1].day).toFixed(1)},${H - B}L${L},${H - B}Z`;
  const fd = d => new Date(d + 'T12:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  const first = pts[0].v, last = pts[pts.length - 1].v, ch = first ? (last - first) / first * 100 : 0, diff = last - first;
  box.innerHTML = `${before}<div class="cohtop"><b>${money(last)}</b><span class="${ch > 0.5 ? 'up' : ch < -0.5 ? 'down' : ''}">${ch > 0 ? '▲' : ch < 0 ? '▼' : ''} ${Math.abs(ch).toFixed(1)}%${Math.abs(diff) >= 0.01 ? ` (${diff > 0 ? '+' : '−'}${money(Math.abs(diff))})` : ''} desde ${fd(pts[0].day)}</span></div>
    <svg viewBox="0 0 ${W} ${H}" class="cohsvg" role="img" aria-label="${esc(aria)}: de ${money(first)} a ${money(last)}">
      <line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="cohax"/>
      <text x="${L - 6}" y="${Y(hi) + 4}" text-anchor="end">${money(hi)}</text><text x="${L - 6}" y="${Y(lo) + 4}" text-anchor="end">${money(lo)}</text>
      <text x="${L}" y="${H - 6}">${fd(pts[0].day)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${fd(pts[pts.length - 1].day)}</text>
      <path d="${area}" class="coharea"/><path d="${line}" class="cohline"/>
      <g class="cohhov" visibility="hidden"><line class="cohx" y1="${T}" y2="${H - B}"/><circle r="4.5" class="cohdot"/></g>
      <rect x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent" class="cohhit"/>
    </svg><div class="cohtip" hidden></div>`;
  const svg = box.querySelector('svg'), hov = svg.querySelector('.cohhov'), tip = box.querySelector('.cohtip');
  svg.querySelector('.cohhit').addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width;
    const q = pts.reduce((a, b) => Math.abs(X(b.day) - x) < Math.abs(X(a.day) - x) ? b : a);
    hov.setAttribute('visibility', 'visible');
    hov.querySelector('line').setAttribute('x1', X(q.day)); hov.querySelector('line').setAttribute('x2', X(q.day));
    hov.querySelector('circle').setAttribute('cx', X(q.day)); hov.querySelector('circle').setAttribute('cy', Y(q.v));
    tip.hidden = false; tip.innerHTML = `<b>${money(q.v)}</b> ${fd(q.day)}`;
    tip.style.left = Math.min(r.width - 90, Math.max(0, X(q.day) * r.width / W - 45)) + 'px';
  });
  svg.querySelector('.cohhit').addEventListener('pointerleave', () => { hov.setAttribute('visibility', 'hidden'); tip.hidden = true; });
}
function drawHistory(box, rows, p, finish, onFinish) {
  const both = ['normal', 'foil'].filter(f => p.finishes.includes(f) && historyPoints(rows, f).length);
  const pts = historyPoints(rows, finish);
  const seg = both.length > 1 ? `<span class="seg cohseg">${both.map(f => `<button data-hf="${f}" class="${f === finish ? 'on' : ''}">${FINISH_ES[f]}</button>`).join('')}</span>` : '';
  if (pts.length < 2) box.innerHTML = `${seg}<div class="cohc">${pts.length ? `Precio hoy: <b>${money(pts[0].v)}</b>. El historial se va armando cada día.` : 'Sin precio en TCGplayer para esta versión.'}</div>`;
  else lineChart(box, pts, `Precio de ${p.name}`, seg);
  box.querySelectorAll('[data-hf]').forEach(b => b.onclick = () => onFinish?.(b.dataset.hf));
}

/* ---------- valor de tu colección en el tiempo ---------- */
const RANGES = [['7', '7 días'], ['30', '30 días'], ['90', '3 meses'], ['all', 'Todo']];
let VRANGE = '30';
function openValue() {
  const items = collection().items;
  if (!Object.keys(items).length) { toast('Agrega cartas a tu colección para ver cuánto vale.'); return; }
  const body = openModal('Valor de tu colección', `
    <div class="full hint">Lo que tienes hoy, a los precios de mercado de TCGplayer de cada día. Normal a precio normal; foil y metal a precio foil.</div>
    <div class="full cohist covalue"><div class="cohc">Cargando…</div></div>
    <div class="full covtop"></div>`, [['Cerrar']]);
  const box = body.querySelector('.covalue');
  topCards(body.querySelector('.covtop'));
  collectionValueHistory(items, 1095).then(rows => {
    if (!box.isConnected) return;
    if (!rows) { box.innerHTML = '<div class="cohc">No se pudo cargar el historial. Revisa tu conexión (o falta actualizar la base de datos: <code>npx supabase db push</code>).</div>'; return; }
    const draw = () => {
      const from = VRANGE === 'all' ? '' : new Date(Date.now() - (+VRANGE) * 864e5).toISOString().slice(0, 10);
      const pts = valuePoints(rows, from);
      const seg = `<span class="seg cohseg">${RANGES.map(([k, l]) => `<button data-vr="${k}" class="${k === VRANGE ? 'on' : ''}">${l}</button>`).join('')}</span>`;
      if (pts.length < 2) box.innerHTML = `${seg}<div class="cohc">${pts.length ? `Hoy vale <b>${money(pts[pts.length - 1].v)}</b>. El historial se va armando cada día.` : 'Todavía no hay precios para tus cartas.'}</div>`;
      else lineChart(box, pts, 'Valor de tu colección', seg);
      box.querySelectorAll('[data-vr]').forEach(b => b.onclick = () => { VRANGE = b.dataset.vr; draw(); });
    };
    draw();
  });
}
/** Las cartas que más valor aportan a tu colección (copias × precio de hoy). */
function topCards(el) {
  const prices = pricesNow(), cat = catalog(); if (!prices || !cat) { el.innerHTML = ''; return; }
  const rows = Object.entries(collection().items).flatMap(([code, row]) => Object.entries(row).map(([fin, n]) => {
    const pr = priceOf(prices, code, fin); return pr == null ? null : { p: cat.byCode.get(code), code, fin, n, pr, v: pr * n };
  })).filter(Boolean).sort((a, b) => b.v - a.v).slice(0, 5);
  el.innerHTML = rows.length ? `<div class="dbsub">Lo que más vale de tu colección</div>${rows.map(r => `<button class="covrow" data-vcard="${esc(r.code)}">
      <img src="${esc(r.p?.img || '')}" alt=""><span><b>${esc(r.p?.name || r.code)}</b><small>${r.code}${r.fin === 'normal' ? '' : ' · ' + (FINISH_ES[r.fin] || r.fin)} · ${r.n} × ${money(r.pr)}</small></span><em>${money(r.v)}</em></button>`).join('')}` : '';
  el.querySelectorAll('[data-vcard]').forEach(b => b.onclick = () => openCard(b.dataset.vcard));
}

/* ---------- exportar ---------- */
function openExport() {
  const cat = catalog(); if (!cat) return;
  const txt = collectionText(cat.prints, collection());
  if (!txt) { toast('Tu colección está vacía.'); return; }
  const body = openModal('Exportar colección', `<div class="full hint">Una línea por carta y acabado, con su código. Sirve para guardarla o compartirla.</div><textarea class="full chtxt" rows="14" readonly>${esc(txt)}</textarea>`,
    [['Cerrar'], ['Descargar .txt', '', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = 'coleccion-riftbound.txt'; a.click(); return false; }],
     ['Copiar', 'primary', () => { navigator.clipboard?.writeText(txt).then(() => toast('Colección copiada', 'ok')); return false; }]]);
  body.querySelector('textarea').select();
}

/* ---------- abrir y cerrar ---------- */
export function showCollection() {
  $('#home').classList.remove('show'); $('#deckb').hidden = true; document.body.classList.remove('indecks');
  $('#collb').hidden = false; document.body.classList.add('incoll');
  load(); renderAll();
  latestPrices().then(d => { if (d && !$('#collb').hidden) renderAll(); }).catch(() => {});
  // el lector de cartas se carga en segundo plano para que el escáner abra al instante
  setTimeout(() => { if (!$('#collb').hidden) warmScanner().catch(() => {}); }, 800);
}
export function hideCollection() { $('#collb').hidden = true; document.body.classList.remove('incoll'); releaseScanner(); }
function scan() {
  const cat = catalog(); if (!cat) { toast('Espera a que cargue el catálogo de cartas.'); return; }
  openScanner({ cat, price: (code, f) => priceOf(pricesNow(), code, f), add: addCopies, count: code => countOf(collection(), code), row: code => collection().items[code] || {} });
}

export function init() {
  SET = ls('rb_coll_set') || '';
  $('#hColl').onclick = showCollection;
  $('#coScan').onclick = scan;
  // toda la tarjeta del valor abre la gráfica (no solo el botón)
  $('#coSum').onclick = () => { if ($('#coSum').classList.contains('click')) openValue(); };
  $('#coExport').onclick = openExport;
  $('#coSets').onclick = e => {
    const b = e.target.closest('[data-set]'); if (!b) return;
    SET = b.dataset.set; ls('rb_coll_set', SET); LIMIT = 240; $('#coGrid').scrollTop = 0; renderSets(); renderHead(); renderGrid();
    document.querySelector('.cocat')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  $('#coHead').onclick = e => {
    if (!e.target.closest('[data-misses]')) return;
    F.own = 'miss'; F.v = 'base'; $('#coVar').value = 'base';
    $('#coOwn').querySelectorAll('[data-own]').forEach(b => b.classList.toggle('on', b.dataset.own === 'miss')); renderGrid();
  };
  const fbar = $('#collb .dbfilters');
  fbar.addEventListener('input', e => {
    const t = e.target; LIMIT = 240;
    if (t.id === 'coQ') F.q = t.value; if (t.id === 'coVar') F.v = t.value; if (t.id === 'coRar') F.rar = t.value; if (t.id === 'coSort') F.sort = t.value;
    renderGrid();
  });
  $('#coOwn').onclick = e => {
    const b = e.target.closest('[data-own]'); if (!b) return;
    F.own = b.dataset.own; $('#coOwn').querySelectorAll('[data-own]').forEach(x => x.classList.toggle('on', x === b)); LIMIT = 240; renderGrid();
  };
  $('#coGrid').addEventListener('click', e => {
    if (e.target.closest('[data-more]')) { LIMIT += 240; renderGrid(); return; }
    const t = e.target.closest('[data-code]'), p = t && catalog()?.byCode.get(t.dataset.code); if (!p) return;
    const b = e.target.closest('[data-co]');
    if (b) { if (b.dataset.co === '+') addCopies(p.code, mainFinish(p), 1); else quickRemove(p); return; }
    openCard(p.code);
  });
  $('#coGrid').addEventListener('contextmenu', e => {
    const t = e.target.closest('[data-code]'), p = t && catalog()?.byCode.get(t.dataset.code); if (!p) return;
    e.preventDefault(); quickRemove(p);
  });
  // el catálogo de OpenRift llega después de arrancar; y la colección puede cambiar desde otra PC
  document.addEventListener('rb:cards', () => { CAT = null; if (!$('#collb').hidden) renderAll(); });
  document.addEventListener('rb:projects', () => { if (dirty) return; load(); document.dispatchEvent(new Event('rb:collection')); if (!$('#collb').hidden) renderAll(); });
}
