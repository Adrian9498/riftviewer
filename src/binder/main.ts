// Página pública de una carpeta (riftviewer.com/carpeta/#slug): se hojea de 9 en 9, sin cuenta.
import './binder.css';
import { binderImg, binderPages, binderSummary, isSpecial, PER_PAGE, type BinderCard } from '../collection/binder';
import { fetchBinder, type PublicBinder } from '../cloud/binder';
import { cloudEnabled } from '../cloud/client';
import { latestPrices, money, priceOf, type DayPrices } from '../cloud/prices';
import { mountAd } from '../ads/ads';
import { startVisits } from '../stats/visits';

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const plural = (n: number, s: string, p = s + 's') => `${n.toLocaleString('es')} ${n === 1 ? s : p}`;
const FIN: Record<string, string> = { foil: 'Foil', metal: 'Metal', 'metal-deluxe': 'Metal Deluxe' };
const VAR: Record<string, string> = { 'Arte alterno': 'Alterna', Firmada: 'Firmada', Sobrenumerada: 'Sobrenumerada', Ultimate: 'Ultimate' };

const S = { b: null as PublicBinder | null, prices: null as DayPrices | null, set: '', special: false, page: 0, spread: 2, first: -1 };

const cards = (): BinderCard[] => (S.b?.data.cards || []).filter(c => (!S.set || c.s === S.set) && (!S.special || isSpecial(c)));
const price = (c: BinderCard) => priceOf(S.prices, c.c, c.f);
const tags = (c: BinderCard) => [VAR[c.v], FIN[c.f]].filter(Boolean) as string[];

function pocket(c: BinderCard | undefined, k: number) {
  if (!c) return '<div class="bvpk empty" aria-hidden="true"></div>';
  const t = tags(c);
  return `<button class="bvpk${c.f !== 'normal' ? ' foil' : ''}" data-k="${k}" title="${esc(c.nm)}">
    <img src="${esc(binderImg(c.i))}" alt="${esc(c.nm)}" loading="lazy" decoding="async">
    ${c.f !== 'normal' ? '<i class="bvshine" aria-hidden="true"></i>' : ''}
    ${t.length ? `<em>${esc(t.join(' · '))}</em>` : ''}${c.n > 1 ? `<b>×${c.n}</b>` : ''}</button>`;
}

function pageHTML(list: BinderCard[], p: number, base: number) {
  const slots = Array.from({ length: PER_PAGE }, (_, k) => pocket(list[k], base + k)).join('');
  return `<div class="bvpage"><div class="bvgrid">${slots}</div><span class="bvpn">${p + 1}</span></div>`;
}

function renderBook(dir = 0) {
  const list = cards(), pages = binderPages(list), per = S.spread;
  const last = Math.max(0, Math.ceil(pages.length / per) - 1);
  S.page = Math.min(Math.max(0, S.page), last);
  const first = S.page * per;
  const shown = pages.slice(first, first + per);
  while (shown.length < per && per === 2 && pages.length > 1) shown.push([]);
  const book = $('#bvBook');
  book.innerHTML = shown.map((pg, k) => pageHTML(pg, first + k, (first + k) * PER_PAGE)).join(per === 2 ? '<i class="bvspine" aria-hidden="true"></i>' : '');
  book.classList.toggle('single', per === 1 || shown.length === 1);
  const moved = first !== S.first; S.first = first;
  if (dir && moved) { book.classList.remove('turn-next', 'turn-prev'); void book.offsetWidth; book.classList.add(dir > 0 ? 'turn-next' : 'turn-prev'); }
  $('#bvPos').textContent = list.length ? `Hojas ${first + 1}${shown.length > 1 ? `–${first + shown.length}` : ''} de ${pages.length}` : 'Sin cartas con este filtro';
  ($('#bvPrev') as HTMLButtonElement).disabled = S.page === 0;
  ($('#bvNext') as HTMLButtonElement).disabled = S.page >= last;
}

function renderSummary() {
  const b = S.b!, sum = binderSummary(b.data.cards, (c, f) => priceOf(S.prices, c, f));
  const when = new Date(b.updatedAt).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  $('#bvStats').innerHTML = `<span><b>${plural(sum.copies, 'carta')}</b><small>${plural(sum.distinct, 'versión', 'versiones')} distintas</small></span>
    ${sum.priced ? `<span><b>${money(sum.value)}</b><small>valor de mercado hoy</small></span>` : ''}
    <span><b>${plural(b.data.cards.filter(isSpecial).length, 'especial', 'especiales')}</b><small>alternas, foil y épicas</small></span>`;
  $('#bvWhen').textContent = `Actualizada el ${when}`;
  $('#bvBest').innerHTML = sum.best.length ? `<h2>Las joyas</h2><div class="bvbest">${sum.best.map(({ card, price: p }) => {
    const k = b.data.cards.indexOf(card);
    return `<button class="bvjewel${card.f !== 'normal' ? ' foil' : ''}" data-all="${k}"><img src="${esc(binderImg(card.i))}" alt="${esc(card.nm)}" loading="lazy">${card.f !== 'normal' ? '<i class="bvshine" aria-hidden="true"></i>' : ''}<span><b>${esc(card.nm)}</b><small>${money(p)}${tags(card).length ? ' · ' + esc(tags(card).join(' · ')) : ''}</small></span></button>`;
  }).join('')}</div>` : '';
}

function renderFilters() {
  const sets = S.b!.data.sets;
  $('#bvSets').innerHTML = [`<button class="bvchip${S.set ? '' : ' on'}" data-set="">Todas</button>`,
    ...sets.map(s => `<button class="bvchip${S.set === s.c ? ' on' : ''}" data-set="${esc(s.c)}" title="${esc(s.n)}">${esc(s.n)}</button>`)].join('');
  ($('#bvSpecial') as HTMLInputElement).checked = S.special;
}

function zoom(c: BinderCard | undefined) {
  const z = $('#bvZoom');
  if (!c) { z.hidden = true; z.innerHTML = ''; return; }
  const p = price(c), t = tags(c);
  z.innerHTML = `<div class="bvzbox"><div class="bvzimg${c.f !== 'normal' ? ' foil' : ''}"><img src="${esc(binderImg(c.i))}" alt="${esc(c.nm)}">${c.f !== 'normal' ? '<i class="bvshine" aria-hidden="true"></i>' : ''}</div>
    <div class="bvzinfo"><h3>${esc(c.nm)}</h3><p>${esc([c.c, c.r, ...t].filter(Boolean).join(' · '))}</p>
    <dl><dt>Copias</dt><dd>${c.n}</dd>${p != null ? `<dt>Precio</dt><dd>${money(p)} c/u</dd>` : ''}</dl>
    <button class="bvzx" data-zx>Cerrar</button></div></div>`;
  z.hidden = false; (z.querySelector('[data-zx]') as HTMLElement).focus();
}

function shell() {
  const b = S.b!;
  document.title = `${b.title || 'Carpeta'} · Riftviewer`;
  $('#bv').innerHTML = `
    <section class="bvhead"><h1>${esc(b.title || 'Carpeta de Riftbound')}</h1><p class="bvwhen" id="bvWhen"></p><div class="bvstats" id="bvStats"></div></section>
    <section id="bvBest"></section>
    <div class="bvbar"><div class="bvsets" id="bvSets"></div><label class="bvsp"><input type="checkbox" id="bvSpecial"> Solo especiales</label></div>
    <div class="bvbook" id="bvBook"></div>
    <nav class="bvnav"><button id="bvPrev" aria-label="Hojas anteriores">‹</button><span id="bvPos"></span><button id="bvNext" aria-label="Hojas siguientes">›</button></nav>
    <div class="adbox" id="bvAd" hidden></div>`;
  renderSummary(); renderFilters(); renderBook(); mountAd($('#bvAd'));
}

function fit() {
  const s = matchMedia('(min-width: 900px)').matches ? 2 : 1;
  if (s !== S.spread) { const first = S.page * S.spread; S.spread = s; S.page = Math.floor(first / s); if (S.b) renderBook(); }
}
const turn = (d: number) => { S.page += d; renderBook(d); };

async function main() {
  fit(); addEventListener('resize', fit);
  const slug = location.hash.replace(/^#\/?/, '').trim().toLowerCase();
  const state = (t: string) => { $('#bv').innerHTML = `<p class="bvstate">${t}</p>`; };
  if (!cloudEnabled) return state('Esta página no está configurada.');
  if (!slug) return state('Falta el enlace de la carpeta. Pídele a su dueño que te lo comparta de nuevo.');
  try { S.b = await fetchBinder(slug); } catch (e) { return state('No se pudo abrir la carpeta. Revisa tu conexión e inténtalo otra vez.'); }
  if (!S.b) return state('Esta carpeta no existe o su dueño dejó de publicarla.');
  shell();
  latestPrices().then(p => { if (p) { S.prices = p.prices; renderSummary(); } }).catch(() => {});

  $('#bv').addEventListener('click', e => {
    const t = e.target as HTMLElement;
    const set = t.closest('[data-set]') as HTMLElement | null;
    if (set) { S.set = set.dataset.set || ''; S.page = 0; renderFilters(); renderBook(); return; }
    if (t.closest('#bvPrev')) return turn(-1);
    if (t.closest('#bvNext')) return turn(1);
    const pk = t.closest('[data-k]') as HTMLElement | null; if (pk) return zoom(cards()[+pk.dataset.k!]);
    const j = t.closest('[data-all]') as HTMLElement | null; if (j) return zoom(S.b!.data.cards[+j.dataset.all!]);
  });
  $('#bv').addEventListener('change', e => { if ((e.target as HTMLElement).id === 'bvSpecial') { S.special = (e.target as HTMLInputElement).checked; S.page = 0; renderBook(); } });
  $('#bvZoom').addEventListener('click', e => { const t = e.target as HTMLElement; if (t.id === 'bvZoom' || t.closest('[data-zx]')) zoom(undefined); });
  addEventListener('keydown', e => {
    if (!$('#bvZoom').hidden) { if (e.key === 'Escape') zoom(undefined); return; }
    if (e.key === 'ArrowRight') turn(1); else if (e.key === 'ArrowLeft') turn(-1);
  });
  // deslizar en el teléfono
  let x0: number | null = null;
  $('#bv').addEventListener('touchstart', e => { x0 = (e.target as HTMLElement).closest('#bvBook') ? e.touches[0].clientX : null; }, { passive: true });
  $('#bv').addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) turn(dx < 0 ? 1 : -1); });
  addEventListener('hashchange', () => location.reload());
}
main();
startVisits();
