// Publicar la colección como carpeta pública (botón "Carpeta pública" de la colección).
// La foto se arma aquí y se guarda en Supabase; la página /carpeta/ la muestra a cualquiera con el enlace.
import { locale } from '../i18n/i18n';
import { buildBinder, isSpecial } from '../collection/binder';
import { myBinder, publishBinder, unpublishBinder } from '../cloud/binder';
import { cloudEnabled } from '../cloud/client';
import { currentUser, displayName } from '../cloud/auth';
import { $, ic } from './base';
import { openAuth } from './account';
import { catalog, collection } from './collection';
import { toast } from './shell';
import { closeModal, esc, openModal } from './utils';

const KEY = 'rb_binder';
const prefs = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
const savePrefs = p => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} };
/** Enlace de la carpeta: /carpeta/ junto a /app/ en el mismo sitio. */
export const shareUrl = slug => new URL(`../carpeta/#${slug}`, location.href.split('#')[0]).href;
const plural = (n, s, p = s + 's') => `${n} ${n === 1 ? s : p}`;

let pub = null;   // tu carpeta publicada: { slug, title, updatedAt } o null

function snapshot(mode) {
  const cat = catalog(); if (!cat) return null;
  return buildBinder(collection(), cat.byCode, cat.sets, mode);
}

function render(body, msg = '') {
  const u = currentUser(), p = prefs();
  if (!cloudEnabled) { body.innerHTML = '<p>La carpeta pública necesita la nube, y no está configurada.</p>'; return; }
  if (!u) {
    body.innerHTML = `<p class="bphint">Publica tu colección como una carpeta de 9 cartas por hoja que cualquiera puede hojear con un enlace: tus alternas, tus foil y cuánto vale todo.</p>
      <p class="bphint">Para publicarla inicia sesión.</p>
      <div class="bpacts"><button class="btn primary" data-bp="login">${ic('user')} Iniciar sesión</button></div>`;
    return;
  }
  const all = snapshot('all');
  if (!all) { body.innerHTML = '<p>Cargando el catálogo de cartas…</p>'; return; }
  const nSpecial = all.cards.filter(isSpecial).length;
  const mode = p.mode === 'special' ? 'special' : 'all';
  const title = p.title ?? `Carpeta de ${displayName(u)}`;
  const link = pub ? shareUrl(pub.slug) : '';
  body.innerHTML = `
    <p class="bphint">Una carpeta de 9 cartas por hoja con tus cartas, sus versiones especiales y el valor de todo. Cualquiera con el enlace puede verla, sin cuenta. No incluye runas básicas ni fichas.</p>
    <label class="bplbl">Nombre de la carpeta<input id="bpTitle" maxlength="60" value="${esc(title)}"></label>
    <div class="bpmode" role="radiogroup" aria-label="Qué cartas mostrar">
      <label><input type="radio" name="bpmode" value="all" ${mode === 'all' ? 'checked' : ''}><span><b>Toda mi colección</b><small>${plural(all.cards.length, 'carta')}</small></span></label>
      <label><input type="radio" name="bpmode" value="special" ${mode === 'special' ? 'checked' : ''}><span><b>Solo las especiales</b><small>alternas, firmadas, foil y épicas · ${plural(nSpecial, 'carta')}</small></span></label>
    </div>
    ${pub ? `<div class="bplink"><span>${ic('check')} Publicada · se ve como estaba al ${new Date(pub.updatedAt).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}</span><input readonly value="${esc(link)}" id="bpLink"></div>` : ''}
    ${msg ? `<p class="bpmsg">${esc(msg)}</p>` : ''}
    <div class="bpacts">
      <button class="btn primary" data-bp="publish">${ic('upload')} ${pub ? 'Actualizar con mi colección de hoy' : 'Publicar mi carpeta'}</button>
      ${pub ? `<button class="btn" data-bp="copy">${ic('copy')} Copiar enlace</button><a class="btn" href="${esc(link)}" target="_blank" rel="noopener">${ic('eye')} Verla</a>
      <button class="btn ghost bpdel" data-bp="unpublish">${ic('trash')} Dejar de publicar</button>` : ''}
    </div>`;
}

async function act(body, what) {
  const u = currentUser();
  if (what === 'login') { closeModal(); openAuth('login'); return; }
  if (!u) return;
  const p = { ...prefs(), title: $('#bpTitle')?.value ?? prefs().title, mode: body.querySelector('[name="bpmode"]:checked')?.value || 'all' };
  savePrefs(p);
  if (what === 'copy') {
    try { await navigator.clipboard.writeText(shareUrl(pub.slug)); toast('Enlace copiado', 'ok'); }
    catch (e) { $('#bpLink')?.select(); }
    return;
  }
  const btns = body.querySelectorAll('.bpacts .btn'); btns.forEach(b => b.disabled = true);
  try {
    if (what === 'publish') {
      const data = snapshot(p.mode);
      if (!data?.cards.length) { render(body, 'No hay cartas que publicar todavía: escanea o agrega algunas primero.'); return; }
      const slug = await publishBinder(u.id, p.title || '', data);
      pub = { slug, title: p.title, updatedAt: new Date().toISOString() };
      render(body, `Listo: ${plural(data.cards.length, 'carta')} en tu carpeta.`);
    } else if (what === 'unpublish') {
      if (!confirm('¿Dejar de publicar tu carpeta? El enlace dejará de funcionar.')) { render(body); return; }
      await unpublishBinder(u.id); pub = null; render(body, 'Tu carpeta ya no está publicada.');
    }
  } catch (e) {
    render(body, 'No se pudo: ' + (e?.message || e));
  }
}

export async function openBinderPublish() {
  const body = openModal('Carpeta pública', '<p>Cargando…</p>', [['Cerrar', '', null]]);
  body.onclick = e => { const b = e.target.closest('[data-bp]'); if (b) act(body, b.dataset.bp); };
  const u = currentUser();
  if (u && cloudEnabled) { try { pub = await myBinder(u.id); } catch (e) { pub = null; } }
  render(body);
}

export function init() {
  $('#coBinder').onclick = openBinderPublish;
}
