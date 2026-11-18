// La página de un mazo, parte "aprender y mejorar":
// - récord contra cada leyenda y rendimiento de cada carta, sacados de sus repeticiones;
// - probabilidades de robo;
// - reemplazos más baratos o que ya tienes, volver a una versión anterior y comparar con otro mazo.
import { decodeReplay } from '../replay/decode';
import { replayMeta } from '../replay/meta';
import {
  ANALYSIS_V, OPENING_HAND, replayResult, alternativesFor, analyzeReplay, baseCode, cardPerformance, compareCounts, countsAtVersion, deckFromCounts,
  fullRecord, matchups, pAny, pAnyMulligan,
} from '../deck/analysis';
import { deckCounts, recordVersion, replayKey, winRate } from '../deck/library';
import { MAX_COPIES } from '../deck/rules';
import { total } from '../deck/model';
import { money } from '../cloud/prices';
import { $, ic } from './base';
import { IDB, cardByCode, deckCard, deckCatalog } from './cards';
import { deckNeedsFor, hasCollection, ownedOf } from './collection';
import { toast } from './shell';
import { esc, openModal } from './utils';
import * as DB from './decks';

const pct = x => x == null ? '—' : Math.round(x * 100) + '%';
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const nameOf = code => deckCard(code)?.name || code;
const thumb = code => { const u = cardByCode(code)?.img; return `<span class="ddth"${u ? ` style="background-image:url('${esc(u)}')"` : ''}></span>`; };

/** Analiza el texto de un replay para un mazo; null si no se puede leer. */
export function analyzeText(text, legend) {
  try { return analyzeReplay(decodeReplay(JSON.parse(text)), legend); } catch (e) { return null; }
}
/** Los replays subidos antes de que existiera el análisis (o con uno viejo) se analizan una vez y se guarda. */
const filling = new Set();
export async function backfill(d, rerender) {
  const todo = (d.replays || []).filter(r => r.analysis?.v !== ANALYSIS_V);
  if (!todo.length || filling.has(d.id)) return;
  filling.add(d.id);
  let changed = false;
  try {
    for (const r of todo) {
      const text = await IDB.get(replayKey(d.id, r.id)).catch(() => null);
      if (typeof text !== 'string') continue;
      const a = analyzeText(text, d.legend); if (a) { r.analysis = a; changed = true; }
      try { r.meta = replayMeta(JSON.parse(text)) || r.meta; } catch (e) {}
    }
  } finally { filling.delete(d.id); }
  if (changed && DB.currentDeck()?.id === d.id) { DB.writeDeck(d); rerender(); }
}

/* ---------- récord ---------- */
export function recordHTML(d) {
  const r = fullRecord(d), g = r.w + r.l, man = d.record || { w: 0, l: 0 };
  const fromRep = (d.replays || []).filter(x => replayResult(x, d.replays) && x.count !== false).length, atTable = (d.games || []).length;
  const side = (k, label) => `<div class="ddres ${k}"><b>${r[k]}</b><small>${label}</small>
    <span><button class="btn mini ico" data-res="${k}" data-delta="-1" title="Quitar una anotada a mano" ${man[k] ? '' : 'disabled'}>−</button><button class="btn mini" data-res="${k}" data-delta="1">${ic('plus')} ${k === 'w' ? 'Victoria' : 'Derrota'}</button></span></div>`;
  return `<section class="ddbox"><h4>${ic('trophy')} Récord de partidas</h4>
    <div class="ddrec">${side('w', 'Victorias')}${side('l', 'Derrotas')}</div>
    ${g ? `<div class="ddwr" title="${pct(winRate(r))} de victorias"><i style="width:${winRate(r) * 100}%"></i></div>
      <p class="dlhint">${pct(winRate(r))} de victorias en ${plural(g, 'partida')}${fromRep ? ` · ${fromRep} de ${fromRep === 1 ? 'una repetición' : 'repeticiones'}` : ''}${atTable ? ` · ${atTable} en la mesa` : ''}.</p>`
      : '<p class="dlhint">Sube las repeticiones de tus partidas y se cuentan solas, o anótalas aquí a mano.</p>'}</section>`;
}

/* ---------- contra cada leyenda ---------- */
export function matchupsHTML(d) {
  const ms = matchups(d.replays || [], d.games || []);
  if (!ms.length) return '';
  return `<section class="ddbox"><h4>${ic('target')} Contra cada leyenda</h4><div class="ddmu">${ms.map(m => {
    const g = m.w + m.l, wr = m.w / g, img = cardByCode(m.legendCode, m.legendName)?.img;
    return `<div class="ddmur"><span class="ddth leg"${img ? ` style="background-image:url('${esc(img)}')"` : ''}></span>
      <span class="ddmun"><b>${esc(m.legendName)}</b><small>${m.w}-${m.l} · ${plural(g, 'partida')}</small></span>
      <span class="ddmub ${wr >= 0.5 ? 'up' : 'down'}"><i style="width:${wr * 100}%"></i></span><em>${pct(wr)}</em></div>`;
  }).join('')}</div></section>`;
}

/* ---------- rendimiento de cada carta ---------- */
export function perfHTML(d) {
  const reps = (d.replays || []).filter(r => r.analysis && replayResult(r, d.replays));
  const head = `<section class="ddsec ddwide"><h3>${ic('chart')} Rendimiento de las cartas${reps.length ? ` <small>en ${plural(reps.length, 'partida')}</small>` : ''}</h3>`;
  if (!reps.length) return `${head}<p class="dlhint">Sube repeticiones de partidas terminadas con este mazo y aquí verás qué cartas jugaste más, con cuáles ganas más y cuáles se te quedan en la mano.</p></section>`;
  const r = fullRecord({ replays: reps }), base = winRate(r);
  // se junta por nombre: la misma carta puede venir con otro código (otra impresión) en el replay y en el mazo
  const key = code => (deckCard(code)?.name || baseCode(code)).toLowerCase();
  const inDeck = new Map();
  for (const c of [...Object.keys(d.main), ...(d.champion ? [d.champion] : [])]) if (!inDeck.has(key(c))) inDeck.set(key(c), c);
  const perf = cardPerformance(reps, key);
  const byKey = new Map(perf.map(p => [key(p.code), p]));
  const empty = code => ({ code, games: reps.length, drawnIn: 0, playedIn: 0, w: 0, l: 0, stuck: 0 });
  const mine = [...inDeck].map(([k, code]) => ({ ...(byKey.get(k) || empty(code)), code }))
    .sort((a, b) => b.playedIn - a.playedIn || b.drawnIn - a.drawnIn || nameOf(a.code).localeCompare(nameOf(b.code)));
  // las que aparecieron en tus partidas pero ya no están en el mazo (cambiaste la lista, o jugaste otra versión)
  const gone = perf.filter(p => !inDeck.has(key(p.code)) && (p.playedIn || p.drawnIn));
  const row = p => {
    const wr = p.playedIn ? p.w / p.playedIn : null;
    const tag = wr == null || p.playedIn < 2 || base == null ? '' : wr >= base + 0.15 ? 'up' : wr <= base - 0.15 ? 'down' : '';
    return `<tr data-code="${esc(p.code)}"><td><span class="ddcn">${thumb(p.code)}${esc(nameOf(p.code))}</span></td>
      <td>${p.playedIn ? `${p.playedIn} <small>de ${p.games}</small>` : '<small>nunca</small>'}</td>
      <td class="${tag}">${wr == null ? '—' : `${pct(wr)} <small>${p.w}-${p.l}</small>`}</td>
      <td class="${p.stuck >= 2 && p.stuck >= p.playedIn ? 'down' : ''}">${p.stuck ? plural(p.stuck, 'copia') : '—'}</td></tr>`;
  };
  const rows = mine.map(row).join('')
    + (gone.length ? `<tr class="grp"><td colspan="4">Jugaste o robaste, pero ya no están en este mazo</td></tr>${gone.map(row).join('')}` : '');
  return `${head}<p class="dlhint">Tu porcentaje general en estas partidas: <b>${pct(base)}</b>. En verde, las cartas con las que ganas bastante más; en rojo, las que van peor o que se te quedan en la mano al final de la partida.</p>
    <div class="ddtbl"><table><thead><tr><th>Carta</th><th>La jugaste</th><th>Ganaste al jugarla</th><th>En la mano al terminar</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

/* ---------- probabilidades ---------- */
let SEEN = 7;
export function probHTML(d) {
  const N = total(d.main);
  if (N < 10) return '';
  const card = c => deckCard(c);
  const rows = Object.entries(d.main).map(([c, k]) => ({ label: nameOf(c), code: c, k }))
    .sort((a, b) => b.k - a.k || a.label.localeCompare(b.label));
  const group = (label, f) => { const k = Object.entries(d.main).filter(([c]) => f(card(c))).reduce((a, [, n]) => a + n, 0); return k ? { label, k, group: true } : null; };
  const groups = [group('Alguna unidad', c => c?.type === 'Unit'), group('Algo de energía 2 o menos', c => c && (c.e ?? 99) <= 2), group('Algún hechizo', c => c?.type === 'Spell')].filter(Boolean);
  const tr = r => `<tr class="${r.group ? 'grp' : ''}"><td><span class="ddcn">${r.code ? thumb(r.code) : ic('cards')}${esc(r.label)}</span></td><td>${r.k}</td>
    <td>${pct(pAny(N, r.k, OPENING_HAND))}</td><td>${pct(pAnyMulligan(N, r.k))}</td><td>${pct(pAny(N, r.k, SEEN))}</td></tr>`;
  const opts = Array.from({ length: 11 }, (_, i) => i + 5).map(n => `<option value="${n}"${n === SEEN ? ' selected' : ''}>${n} cartas</option>`).join('');
  return `<section class="ddsec ddwide"><h3>${ic('sparkle')} Probabilidades de robo <small>${N} cartas sin el campeón</small></h3>
    <p class="dlhint">Probabilidad de tener al menos una copia entre las ${N} cartas del mazo (sin el campeón). La mano inicial es de ${OPENING_HAND}; con mulligan devuelves hasta 2 buscándola.</p>
    <div class="ddtbl"><table><thead><tr><th>Carta</th><th>Copias</th><th>Mano inicial</th><th>Con mulligan</th><th>Tras ver <select id="ddSeen" aria-label="Cartas vistas">${opts}</select></th></tr></thead>
    <tbody>${groups.map(tr).join('')}${rows.map(tr).join('')}</tbody></table></div></section>`;
}
export function setSeen(n) { SEEN = n; }

/* ---------- mano de prueba: barajar, mano inicial, mulligan y robar ---------- */
const MULL_MAX = 2;
let H = null;   // { id, lib, hand, opening, sel, mull }
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export function newHand(d) {
  const lib = shuffle(Object.entries(d.main).flatMap(([c, n]) => Array(n).fill(c)));
  H = { id: d.id, lib, hand: lib.splice(0, OPENING_HAND), opening: OPENING_HAND, sel: new Set(), mull: false };
}
/** Las elegidas se apartan, robas otras tantas y las apartadas van al fondo del mazo. */
export function mulligan() {
  if (!H || H.mull || !H.sel.size) return;
  const out = [...H.sel].sort((a, b) => b - a).map(i => H.hand.splice(i, 1)[0]);
  H.hand.push(...H.lib.splice(0, out.length));
  H.lib.push(...shuffle(out));
  H.sel.clear(); H.mull = true;
}
export function drawCard() {
  if (!H?.lib.length) return;
  H.sel.clear(); H.mull = true;
  H.hand.push(H.lib.shift());
}
export function pickHandCard(i) {
  if (!H || H.mull || i >= H.opening) return;
  if (H.sel.has(i)) H.sel.delete(i); else if (H.sel.size < MULL_MAX) H.sel.add(i);
}
export function handHTML(d) {
  const N = total(d.main);
  if (N < OPENING_HAND) return '';
  if (H?.id !== d.id || H.lib.length + H.hand.length !== N) newHand(d);
  const extra = H.hand.length - H.opening;
  const hint = !H.mull
    ? `Tu mano inicial de ${OPENING_HAND}. Toca hasta ${MULL_MAX} cartas para devolverlas en el mulligan, o roba para seguir con esta.`
    : `Quedan ${plural(H.lib.length, 'carta')} en el mazo${extra > 0 ? ` · robaste ${extra}` : ''}.`;
  return `<div id="ddHand">
    <div class="ddhbar">
      <button class="btn mini" data-hand="new">${ic('replay')} Nueva mano</button>
      ${H.mull ? '' : `<button class="btn mini${H.sel.size ? ' primary' : ''}" data-hand="mull"${H.sel.size ? '' : ' disabled'}>${ic('flip')} Mulligan${H.sel.size ? ` (${H.sel.size})` : ''}</button>`}
      <button class="btn mini" data-hand="draw"${H.lib.length ? '' : ' disabled'}>${ic('plus')} Robar carta</button>
    </div>
    <p class="dlhint">${hint}</p>
    <div class="ddhand">${H.hand.map((c, i) => {
      const name = nameOf(c), img = cardByCode(c)?.img || '', pick = !H.mull && i < H.opening;
      return `<${pick ? 'button' : 'div'} class="ddhc${H.sel.has(i) ? ' sel' : ''}${i >= H.opening ? ' new' : ''}"${pick ? ` data-hcard="${i}" aria-pressed="${H.sel.has(i)}"` : ''} data-code="${esc(c)}" title="${esc(name)}">
        <img src="${esc(img)}" alt="${esc(name)}">${i >= H.opening ? `<b>+${i - H.opening + 1}</b>` : ''}${H.sel.has(i) ? `<em>${ic('flip')} Al fondo</em>` : ''}</${pick ? 'button' : 'div'}>`;
    }).join('')}</div></div>`;
}

/* ---------- pestañas de la página: la lista, rendimiento, probabilidades, reemplazos ---------- */
let TAB = 'deck', TAB_DECK = null;   // al abrir otro mazo se empieza por la lista
export function insightsHTML(d, shared, list, count) {
  if (d.id !== TAB_DECK) { TAB_DECK = d.id; TAB = 'deck'; }
  const reps = (d.replays || []).filter(r => r.analysis && replayResult(r, d.replays)).length;
  const tabs = [
    { id: 'deck', icon: 'cards', label: 'Mazo', badge: count, html: list },
    { id: 'hand', icon: 'play', label: 'Mano de prueba', html: handHTML(d) },
    !shared && { id: 'perf', icon: 'chart', label: 'Rendimiento', badge: reps || '', html: perfHTML(d) },
    { id: 'prob', icon: 'sparkle', label: 'Probabilidades', html: probHTML(d) },
    !shared && { id: 'alt', icon: 'bulb', label: 'Reemplazos', html: altHTML(d) },
  ].filter(t => t && t.html);
  if (tabs.length < 2) return tabs[0]?.html || '';
  const on = tabs.find(t => t.id === TAB)?.id || tabs[0].id;
  return `<div class="ddins">
    <div class="ddtabs" role="tablist" aria-label="Secciones del mazo">${tabs.map(t => `<button role="tab" id="ddtab-${t.id}" data-instab="${t.id}" aria-controls="ddpan-${t.id}" aria-selected="${t.id === on}" tabindex="${t.id === on ? 0 : -1}" class="${t.id === on ? 'on' : ''}">
      ${ic(t.icon)} ${t.label}${t.badge ? ` <small>${t.badge}</small>` : ''}</button>`).join('')}</div>
    ${tabs.map(t => `<div class="ddpan" role="tabpanel" id="ddpan-${t.id}" aria-labelledby="ddtab-${t.id}"${t.id === on ? '' : ' hidden'}>${t.html}</div>`).join('')}
  </div>`;
}
/** Cambia de pestaña sin volver a dibujar la página (se recuerda al volver a entrar). */
export function showInsightsTab(root, id) {
  TAB = id;
  for (const b of root.querySelectorAll('[data-instab]')) { const on = b.dataset.instab === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; }
  for (const p of root.querySelectorAll('.ddpan')) p.hidden = p.id !== `ddpan-${id}`;
}

/* ---------- reemplazos ---------- */
export function altHTML(d) {
  const legend = d.legend && deckCard(d.legend); if (!legend) return '';
  const cards = Object.entries(d.main).map(([code, n]) => ({ code, name: nameOf(code), n }));
  const needs = deckNeedsFor(cards), coll = hasCollection();
  if (!needs.some(x => x.price != null) && !coll) return '';
  // las que te faltan, o las más caras si no hay colección
  const targets = needs.filter(x => { const c = deckCard(x.code); return c && c.sup !== 'Signature' && c.sup !== 'Champion' && (coll ? x.miss > 0 : (x.price ?? 0) >= 2); })
    .sort((a, b) => (b.price ?? 0) * (coll ? b.miss : b.n) - (a.price ?? 0) * (coll ? a.miss : a.n)).slice(0, 6);
  const head = `<section class="ddsec ddwide"><h3>${ic('bulb')} Ahorra o usa lo que tienes</h3>`;
  if (!targets.length) return `${head}<p class="dlhint">${coll ? 'Tienes todas las cartas de este mazo.' : 'No hay cartas caras que reemplazar.'}</p></section>`;
  const inDeck = new Set(cards.map(c => c.name)), cat = deckCatalog().map(c => deckCard(c.code)).filter(Boolean);
  const cache = new Map();
  const info = c => { if (!cache.has(c.name)) cache.set(c.name, { price: deckNeedsFor([{ code: c.code, name: c.name, n: 1 }])[0]?.price ?? null, owned: ownedOf(c) }); return cache.get(c.name); };
  const rows = targets.map(t => {
    const card = deckCard(t.code), alts = alternativesFor(card, t.price, legend.dom, cat, inDeck, info);
    return `<div class="ddalt"><div class="ddalt-from">${thumb(t.code)}<span><b>${esc(t.name)}</b><small>×${t.n}${t.price != null ? ` · ${money(t.price)} c/u` : ''}${coll && t.miss ? ` · te faltan ${t.miss}` : ''}</small></span></div>
      <div class="ddalt-to">${alts.length ? alts.map(a => `<button class="ddalt-c" data-swap="${esc(t.code)}" data-to="${esc(a.card.code)}" title="Cambiar ${esc(t.name)} por ${esc(a.card.name)}">
        ${thumb(a.card.code)}<span><b>${esc(a.card.name)}</b><small>${a.owned ? `${ic('check')} tienes ${a.owned}` : ''}${a.owned && a.price != null ? ' · ' : ''}${a.price != null ? money(a.price) : ''}</small></span></button>`).join('')
        : '<small class="dlhint">Sin reemplazos parecidos.</small>'}</div></div>`;
  }).join('');
  return `${head}<p class="dlhint">${coll ? 'Para las cartas que te faltan' : 'Para las cartas más caras'}: otras del mismo tipo, de tus dominios y con energía parecida${coll ? ' que ya tienes o' : ''} que cuestan menos. Pulsa una para cambiarla en el mazo; se guarda como versión nueva, así que puedes volver atrás.</p>
    <div class="ddalts">${rows}</div></section>`;
}
export function swapCard(d, from, to) {
  const n = d.main[from]; if (!n) return;
  const before = deckCounts(d);
  delete d.main[from];
  d.main[to] = Math.min(MAX_COPIES, (d.main[to] || 0) + n);
  recordVersion(d, before); DB.writeDeck(d);
  toast(`Cambiado: ${nameOf(from)} por ${nameOf(to)}. Puedes volver atrás desde el historial.`, 'ok');
}

/* ---------- versiones ---------- */
export function restoreVersion(d, k, done) {
  const h = d.history || []; if (!h[k]) return;
  openModal('Volver a esta versión', `<p class="full">El mazo quedará como estaba en la <b>versión ${h.length - k}</b>. Lo de ahora no se pierde: se guarda en el historial y puedes regresar.</p>`,
    [['Cancelar'], ['Volver a esta versión', 'primary', () => {
      const before = deckCounts(d), nd = deckFromCounts(d, countsAtVersion(before, h, k), deckCard);
      Object.assign(d, { legend: nd.legend, champion: nd.champion, main: nd.main, runes: nd.runes, battlefields: nd.battlefields, side: nd.side });
      recordVersion(d, before); DB.writeDeck(d); done(); toast(`El mazo volvió a la versión ${h.length - k}`, 'ok');
    }]]);
}

/* ---------- comparar con otro mazo ---------- */
export function openCompare(d) {
  const others = DB.allDecks().filter(x => x.id !== d.id);
  if (!others.length) { toast('Necesitas otro mazo para comparar'); return; }
  const body = openModal('Comparar mazos', `<label class="full">Comparar <b>${esc(d.name || 'este mazo')}</b> con
      <select id="ddCmpSel">${others.map(o => `<option value="${esc(o.id)}">${esc(o.name || 'Sin nombre')}</option>`).join('')}</select></label>
    <div class="full" id="ddCmpOut"></div>`, [['Cerrar', 'primary']]);
  const line = (k, txt) => { const side = k.startsWith('side:'), code = side ? k.slice(5) : k; return `<div>${thumb(code)}<span>${esc(nameOf(code))}${side ? ' <small>(banquillo)</small>' : ''}</span><b>${txt}</b></div>`; };
  const show = () => {
    const o = others.find(x => x.id === $('#ddCmpSel').value); if (!o) return;
    const diff = compareCounts(deckCounts(d), deckCounts(o));
    const col = (title, items) => `<div class="ddcmpc"><h5>${title} <small>${items.length}</small></h5>${items.join('') || '<small class="dlhint">Nada</small>'}</div>`;
    $('#ddCmpOut').innerHTML = !diff.onlyA.length && !diff.onlyB.length && !diff.changed.length ? '<p class="dlhint">Los dos mazos tienen exactamente las mismas cartas.</p>'
      : `<div class="ddcmp">${col('Solo en este', diff.onlyA.map(([k, n]) => line(k, '×' + n)))}${col('Solo en ' + esc(o.name || 'el otro'), diff.onlyB.map(([k, n]) => line(k, '×' + n)))}
        ${col('Distinta cantidad', diff.changed.map(([k, a, b]) => line(k, `${a} → ${b}`)))}</div>`;
  };
  body.querySelector('#ddCmpSel').onchange = show; show();
}
