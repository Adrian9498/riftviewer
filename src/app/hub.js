// Inicio: el resumen de arriba (tus mazos, tu récord, tu colección) y los atajos para seguir donde te quedaste.
// Las tarjetas de cada sección están en index.html; aquí solo se conecta la de intercambios y se pinta el resumen.
import { $, ic } from './base';
import { fullRecord } from '../deck/analysis';
import { collection } from './collection';
import * as DB from './decks';
import { openTable } from './table';
import { openTrade } from './trade';
import { esc } from './utils';
import { mountAd } from '../ads/ads';

const MESA_FRESH = 6 * 3600 * 1000;
const plural = (n, s, p = s + 's') => `${n} ${n === 1 ? s : p}`;

/** La partida de "En la mesa" que quedó abierta (con mazo o cartas vistas), si es reciente. */
function openMesa() {
  try {
    const m = JSON.parse(localStorage.getItem('rb_mesa') || 'null');
    return m && Date.now() - (m.ts || 0) < MESA_FRESH && (m.deckId || m.seen?.length || m.opp) ? m : null;
  } catch (e) { return null; }
}

export function renderHub() {
  const box = $('#hStats'); if (!box) return;
  const decks = DB.allDecks();
  const rec = decks.reduce((r, d) => { const x = fullRecord(d); r.w += x.w; r.l += x.l; return r; }, { w: 0, l: 0 });
  let cards = 0;
  try { for (const row of Object.values(collection().items)) for (const n of Object.values(row)) cards += n > 0 ? n : 0; } catch (e) {}
  const mesa = openMesa(), last = decks[0];
  const chips = [];
  if (mesa) chips.push(`<button class="hchip go" data-hgo="mesa">${ic('camera')}<span><small>Tienes una partida abierta</small><b>Volver a la mesa</b></span></button>`);
  if (last) chips.push(`<button class="hchip go" data-hgo="deck" data-id="${esc(last.id)}">${ic('cards')}<span><small>Seguir con</small><b>${esc(last.name || 'Mazo sin nombre')}</b></span></button>`);
  if (decks.length) chips.push(`<button class="hchip" data-hgo="decks">${ic('chart')}<span><small>${plural(decks.length, 'mazo')}</small><b>${rec.w + rec.l ? `Récord ${rec.w}-${rec.l}` : 'Sin partidas aún'}</b></span></button>`);
  if (cards) chips.push(`<button class="hchip" data-hgo="coll">${ic('binder')}<span><small>Tu colección</small><b>${plural(cards, 'carta')}</b></span></button>`);
  box.innerHTML = chips.join('');
  box.hidden = !chips.length;
  // el anuncio del inicio se pone cuando el inicio está a la vista (sin ancho, AdSense no lo llena)
  if ($('#home').classList.contains('show')) mountAd($('#hAd'));
}

export function init() {
  $('#hTrade').onclick = () => openTrade('have');
  $('#hStats').onclick = e => {
    const b = e.target.closest('[data-hgo]'); if (!b) return;
    const go = b.dataset.hgo;
    if (go === 'mesa') openTable(openMesa()?.deckId || '');
    else if (go === 'coll') $('#hColl').click();
    else if (go === 'decks') DB.showDecks();
    else if (go === 'deck') {
      const d = DB.allDecks().find(x => x.id === b.dataset.id);
      DB.showDecks(); if (d) { DB.useDeck(d); DB.setView('detail'); }
    }
  };
  // se vuelve a pintar cada vez que aparece el inicio, y cuando llegan las cartas o cambian los datos de la nube
  new MutationObserver(() => { if ($('#home').classList.contains('show')) renderHub(); })
    .observe($('#home'), { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('rb:cards', () => { if ($('#home').classList.contains('show')) renderHub(); });
  addEventListener('storage', () => { if ($('#home').classList.contains('show')) renderHub(); });
  renderHub();
}
