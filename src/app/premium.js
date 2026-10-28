// Full Access: ventana que explica cómo desbloquear, candados y marca de agua del plan Gratis.
import { currentUser, onUserChange } from '../cloud/auth';
import { cloudEnabled } from '../cloud/client';
import { connectPatreon, patreonLink } from '../cloud/patreon';
import { FEATURES, isPremium, onPlanChange, refreshPlan } from '../cloud/plan';
import { $ } from './base';
import { openAuth } from './account';
import { applyBrand } from './brand';
import { toast } from './shell';
import { closeModal, esc, openModal, rerender } from './utils';

const PATREON_URL = import.meta.env.VITE_PATREON_URL;

/** true si el usuario tiene Full Access; si no, explica cómo conseguirlo y devuelve false. */
export function needPremium(feature) {
  if (isPremium()) return true;
  openUpsell(feature);
  return false;
}

export async function openUpsell(feature) {
  const body = openModal('🔒 Full Access', `
    <div class="full">${feature ? `<p class="upsell-why">Esta función es parte de <b>Full Access</b>.</p>` : ''}
      <ul class="upsell-list">${Object.entries(FEATURES).map(([k, f]) => `<li${k === feature ? ' class="hl"' : ''}>${esc(f)}</li>`).join('')}</ul>
      <p class="hint">Ver replays y guiones, las distribuciones, la cámara, los sonidos y tu cuenta con sincronización siguen siendo gratis.</p></div>
    <div class="full hint" id="upHow">Revisando tu cuenta…</div>
    <div class="full row" id="upActs" style="padding:4px 0 0"></div>`, [['Cerrar', 'primary']]);
  const how = $('#upHow'), acts = $('#upActs');
  const support = PATREON_URL ? `<a class="btn pt" href="${esc(PATREON_URL)}" target="_blank" rel="noopener">Apoyar en Patreon</a>` : '';
  if (!cloudEnabled) { how.textContent = 'Esta copia de la app no tiene cuentas configuradas.'; return; }
  const u = currentUser();
  let link = null;
  if (u) { try { link = await patreonLink(); } catch (e) { /* sin conexión */ } }
  if (!u) {
    how.innerHTML = 'Full Access se obtiene apoyando en Patreon. <b>Inicia sesión</b> (o crea tu cuenta gratis) y conecta tu Patreon desde <b>Tu cuenta</b>.';
    acts.innerHTML = `<button class="btn primary" id="upLogin">Iniciar sesión</button>${support}`;
  } else if (!link) {
    how.innerHTML = '¿Ya apoyas en Patreon? <b>Conecta tu cuenta</b> y se desbloquea al instante. Si aún no, puedes apoyar y volver aquí.';
    acts.innerHTML = `<button class="btn pt" id="upConnect">Conectar con Patreon</button>${PATREON_URL ? `<a class="btn" href="${esc(PATREON_URL)}" target="_blank" rel="noopener">Ver Patreon</a>` : ''}`;
  } else {
    how.innerHTML = 'Tu Patreon está conectado, pero no tiene Full Access activo. Si acabas de apoyar o cambiar de nivel, pulsa <b>Ya apoyé</b>.';
    acts.innerHTML = `${support}<button class="btn" id="upRefresh">Ya apoyé: actualizar</button>`;
  }
  const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
  on('#upLogin', () => openAuth());
  on('#upConnect', async () => { try { await connectPatreon(); } catch (e) { toast(e.message, 'err'); } });
  on('#upRefresh', async () => {
    await refreshPlan();
    if (isPremium()) { closeModal(); toast('¡Full Access activado! Gracias por tu apoyo.', 'ok'); }
    else toast('Todavía no aparece tu apoyo. Patreon puede tardar unos minutos en avisar; si sigue igual, desconecta y vuelve a conectar Patreon en Tu cuenta.');
  });
}

export function init() {
  // body.free activa los candados (CSS) y la marca de agua al grabar
  let last = null;
  const paint = () => {
    const full = isPremium();
    document.body.classList.toggle('free', !full);
    if (full === last) return;
    applyBrand();
    if (last !== null) rerender();   // cambió el tamaño/alineación efectiva del tablero
    last = full;
  };
  onPlanChange(paint);
  if (!cloudEnabled) return;
  onUserChange((u, ev) => { if (ev !== 'TOKEN_REFRESHED') refreshPlan().then(paint); });
  addEventListener('focus', () => { if (currentUser()) refreshPlan(); });
}
