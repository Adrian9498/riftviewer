// Páginas de guías (riftviewer.com/guides/…): ya vienen escritas desde la compilación en inglés y español.
// Aquí solo: idioma, vista previa de cartas al pasar o tocar su nombre, anuncio y visitas.
import './guides.css';
import '../i18n/i18n.css';
import { mountAd } from '../ads/ads';
import { startDomTranslation } from '../i18n/dom';
import { LANG, wireLangSwitch } from '../i18n/i18n';
import { startVisits } from '../stats/visits';

startDomTranslation();
wireLangSwitch();
document.querySelectorAll<HTMLElement>('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === LANG));
if (LANG === 'es') {
  const t = document.querySelector<HTMLMetaElement>('meta[name="guide-es-title"]')?.content;
  if (t) document.title = t;
}

// vista previa de una carta: sigue al ratón; en pantallas táctiles se abre al tocar y se cierra al tocar fuera
const zoom = document.getElementById('gzoom') as HTMLElement;
const img = zoom.querySelector('img') as HTMLImageElement;
let pinned: HTMLElement | null = null;
function show(el: HTMLElement, x: number, y: number) {
  if (img.src !== el.dataset.img) img.src = el.dataset.img || '';
  zoom.hidden = false;
  const w = 220, h = 307;
  zoom.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 18)) + 'px';
  zoom.style.top = Math.max(8, Math.min(innerHeight - h - 8, y - h / 2)) + 'px';
}
const hide = () => { zoom.hidden = true; pinned = null; };
document.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  const el = (e.target as HTMLElement).closest<HTMLElement>('.gcard');
  if (el) show(el, e.clientX, e.clientY); else if (!pinned) zoom.hidden = true;
});
document.addEventListener('click', e => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('.gcard');
  if (!el) { hide(); return; }
  const r = el.getBoundingClientRect();
  pinned = el;
  show(el, r.left, r.top + r.height / 2);
});
document.addEventListener('focusin', e => {
  const el = (e.target as HTMLElement).closest?.<HTMLElement>('.gcard');
  if (el) { const r = el.getBoundingClientRect(); show(el, r.left, r.top + r.height / 2); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
addEventListener('scroll', () => { if (pinned) hide(); }, { passive: true });

// el anuncio va en la versión del idioma que se ve
mountAd(document.querySelector<HTMLElement>(`.g-${LANG} .adbox`));
startVisits();

// jugadas animadas: la app incrustada se carga solo al pedirla (pesa, y así cada jugada empieza desde cero)
document.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.gwatch');
  if (!b) return;
  const f = document.createElement('iframe');
  f.src = b.dataset.src || '';
  f.title = b.textContent || 'Riftviewer';
  f.allow = 'fullscreen';
  f.setAttribute('allowfullscreen', '');
  b.replaceWith(f);
});
