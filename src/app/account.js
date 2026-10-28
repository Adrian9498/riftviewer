// Cuenta: iniciar sesión / crear cuenta (correo, Google, Discord), menú de la cuenta y estado de la nube.
import { currentUser, displayName, enabledProviders, initAuth, onUserChange, sendPasswordReset, setNewPassword, signIn, signInWith, signOut, signUp } from '../cloud/auth';
import { cloudEnabled } from '../cloud/client';
import { connectPatreon, disconnectPatreon, patreonLink, takePatreonReturn } from '../cloud/patreon';
import { currentPlan, isPremium, refreshPlan } from '../cloud/plan';
import { configureSync, onSyncStatus, syncNow, syncStatus } from '../cloud/sync';
import { openUpsell } from './premium';
import { $, ic } from './base';
import { localAdapter } from './cloud-adapter';
import { ago, toast } from './shell';
import { closeModal, esc, openModal } from './utils';

let lastError = '';
// nombres visibles de los planes; los demás se muestran con su clave (los define el secreto PATREON_TIERS)
const TIERS = { free: 'Gratis', full: 'Full Access' };
const tierLabel = t => TIERS[t] || (t ? t[0].toUpperCase() + t.slice(1) : 'Gratis');

// el botón está en la barra superior y también en la pantalla de inicio (que tapa la barra)
const BUTTONS = ['#bAccount', '#hAccount'];
function renderButton(u) {
  const s = syncStatus();
  for (const sel of BUTTONS) {
    const b = $(sel);
    b.innerHTML = u ? `<span class="sdot ${s.state}"></span>${esc(displayName(u))}` : `${ic('user')} Entrar`;
    b.title = u ? 'Tu cuenta y sincronización' : 'Iniciar sesión o crear cuenta';
  }
}
function syncText(s) {
  if (s.state === 'syncing') return 'Sincronizando…';
  if (s.state === 'error') return 'Error: ' + s.error;
  if (s.state === 'idle') return s.lastSync ? `Al día · ${ago(s.lastSync)}` : 'Al día';
  return 'Sin conexión con la nube';
}

export function openAuth(mode = 'login') {
  const login = mode === 'login';
  const body = openModal(login ? 'Iniciar sesión' : 'Crear cuenta', `
    <div class="full oauth" hidden><button class="btn oa google" data-oa="google" hidden>Continuar con Google</button><button class="btn oa discord" data-oa="discord" hidden>Continuar con Discord</button></div>
    <div class="full sep" hidden><span>o con tu correo</span></div>
    <span>Correo</span><input type="email" id="auEmail" autocomplete="email" placeholder="tu@correo.com">
    <span>Contraseña</span><input type="password" id="auPass" autocomplete="${login ? 'current-password' : 'new-password'}" placeholder="${login ? '' : 'Mínimo 6 caracteres'}">
    <div class="full aumsg" id="auMsg"></div>
    <div class="full hint">${login ? '¿No tienes cuenta? <a href="#" data-sw="signup">Crea una</a> · <a href="#" data-forgot>¿Olvidaste tu contraseña?</a>'
                                   : '¿Ya tienes cuenta? <a href="#" data-sw="login">Inicia sesión</a>'}</div>
    <div class="full hint">Con tu cuenta, tu marca, sonidos, clips, notas, recientes e imágenes se guardan en la nube y los tienes en cualquier PC. Sin cuenta todo sigue funcionando en este navegador.</div>`,
    [['Cancelar'], [login ? 'Entrar' : 'Crear cuenta', 'primary', () => { submit(); return false; }]]);
  const msg = (t, err) => { const m = $('#auMsg'); m.textContent = t; m.className = 'full aumsg ' + (err ? 'err' : 'ok'); };
  async function submit() {
    const email = $('#auEmail').value.trim(), pw = $('#auPass').value;
    if (!email || !pw) { msg('Escribe tu correo y tu contraseña.', true); return; }
    try {
      if (login) { await signIn(email, pw); closeModal(); toast('Sesión iniciada', 'ok'); return; }
      if (await signUp(email, pw)) msg('¡Listo! Te enviamos un correo para confirmar tu cuenta. Ábrelo y vuelve aquí.');
      else { closeModal(); toast('Cuenta creada', 'ok'); }
    } catch (e) { msg(e.message, true); }
  }
  body.onclick = async e => {
    const oa = e.target.closest('[data-oa]');
    if (oa) { try { await signInWith(oa.dataset.oa); } catch (err) { msg(err.message, true); } return; }
    const sw = e.target.closest('[data-sw]');
    if (sw) { e.preventDefault(); openAuth(sw.dataset.sw); return; }
    if (e.target.closest('[data-forgot]')) {
      e.preventDefault();
      const email = $('#auEmail').value.trim();
      if (!email) { msg('Escribe tu correo arriba y vuelve a pulsar "¿Olvidaste tu contraseña?".', true); return; }
      try { await sendPasswordReset(email); msg('Te enviamos un correo para crear una contraseña nueva.'); } catch (err) { msg(err.message, true); }
    }
  };
  body.onkeydown = e => { if (e.key === 'Enter') submit(); };
  $('#auEmail').focus();
  // solo mostrar Google/Discord si están activados en Supabase (si no, Supabase responde con un error en crudo)
  enabledProviders().then(p => {
    let any = false;
    for (const k of ['google', 'discord']) { const b = body.querySelector(`[data-oa="${k}"]`); if (b) { b.hidden = !p[k]; any ||= p[k]; } }
    const oa = body.querySelector('.oauth'), sep = body.querySelector('.sep');
    if (oa) { oa.hidden = !any; oa.style.gridTemplateColumns = p.google && p.discord ? '1fr 1fr' : '1fr'; }
    if (sep) sep.hidden = !any;
  });
}

function openNewPassword() {
  const body = openModal('Nueva contraseña', `
    <span>Contraseña nueva</span><input type="password" id="npPass" autocomplete="new-password" placeholder="Mínimo 6 caracteres">
    <div class="full aumsg" id="npMsg"></div>`,
    [['Cancelar'], ['Guardar', 'primary', () => { save(); return false; }]]);
  async function save() {
    try { await setNewPassword($('#npPass').value); closeModal(); toast('Contraseña actualizada', 'ok'); }
    catch (e) { const m = $('#npMsg'); m.textContent = e.message; m.className = 'full aumsg err'; }
  }
  body.onkeydown = e => { if (e.key === 'Enter') save(); };
}

export function openAccount() {
  const u = currentUser();
  if (!u) return openAuth();
  const body = openModal('Tu cuenta', `
    <span>Nombre</span><b>${esc(displayName(u))}</b>
    <span>Correo</span><span>${esc(u.email || '—')}</span>
    <span>Plan</span><span id="acTier"></span>
    <span>Patreon</span><div id="acPatreon"><small style="color:var(--muted)">Revisando…</small></div>
    <span>Nube</span><span id="acSync">${esc(syncText(syncStatus()))}</span>
    <div class="full row" style="padding:6px 0 0"><button class="btn" id="acSyncNow">⟳ Sincronizar ahora</button><button class="btn" id="acOut">Cerrar sesión</button></div>
    <div class="full hint">Se sincronizan tu marca, sonidos, vista, clips, notas, los 8 recientes y tus imágenes y audios propios. Si cambias lo mismo en dos PCs, gana el cambio más reciente. Al cerrar sesión, lo que ya está en este navegador se queda aquí.</div>`,
    [['Cerrar', 'primary']]);
  body.querySelector('#acSyncNow').onclick = () => syncNow();
  body.querySelector('#acOut').onclick = async () => { await signOut(); closeModal(); toast('Sesión cerrada'); };
  paintTier(); refreshPlan().then(paintTier);
  paintPatreon();
}

// plan actual: nombre y vigencia; si es Gratis, enlace para ver qué incluye Full Access
function paintTier() {
  const el = $('#acTier'); if (!el) return;
  const p = currentPlan();
  if (isPremium()) {
    const until = p.validUntil ? ` <small style="color:var(--muted)">· vigente hasta el ${new Date(p.validUntil).toLocaleDateString('es')}</small>` : '';
    el.innerHTML = `<b class="pt-on">${esc(tierLabel(p.tier))}</b>${until}`;
  } else {
    el.innerHTML = 'Gratis <a href="#" id="acUp">Ver Full Access</a>';
    $('#acUp').onclick = e => { e.preventDefault(); openUpsell(); };
  }
}

async function paintPatreon() {
  const box = $('#acPatreon'); if (!box) return;
  let link = null;
  try { link = await patreonLink(); } catch (e) { /* sin conexión: se muestra como no conectado */ }
  box.innerHTML = link
    ? `<span class="pt-on">● Conectado${link.patron_status === 'active_patron' ? '' : ' (sin apoyo activo)'}</span> <button class="btn mini" id="ptOff">Desconectar</button>`
    : `<button class="btn mini pt" id="ptOn">Conectar con Patreon</button> <small style="color:var(--muted)">para desbloquear tu plan si apoyas en Patreon</small>`;
  const on = $('#ptOn'), off = $('#ptOff');
  if (on) on.onclick = async () => { on.disabled = true; on.textContent = 'Abriendo Patreon…'; try { await connectPatreon(); } catch (e) { toast(e.message, 'err'); on.disabled = false; on.textContent = 'Conectar con Patreon'; } };
  if (off) off.onclick = async () => {
    if (!confirm('¿Desconectar tu cuenta de Patreon? Tu plan volverá a Gratis.')) return;
    try { await disconnectPatreon(); await refreshPlan(); paintTier(); toast('Patreon desconectado'); paintPatreon(); }
    catch (e) { toast(e.message, 'err'); }
  };
}

export function init() {
  if (!cloudEnabled) return;   // sin configuración de Supabase la app funciona solo en local
  for (const sel of BUTTONS) { $(sel).hidden = false; $(sel).onclick = () => (currentUser() ? openAccount() : openAuth()); }
  configureSync(localAdapter);
  onSyncStatus(s => {
    renderButton(currentUser());
    const el = $('#acSync'); if (el) el.textContent = syncText(s);
    if (s.state === 'error' && s.error !== lastError) toast('No se pudo sincronizar: ' + s.error, 'err');
    lastError = s.state === 'error' ? s.error : '';
  });
  onUserChange((u, ev) => {
    renderButton(u);
    if (ev === 'PASSWORD_RECOVERY') openNewPassword();
    if (u && ['INITIAL', 'INITIAL_SESSION', 'SIGNED_IN'].includes(ev)) syncNow();
  });
  addEventListener('focus', () => { if (currentUser()) syncNow(); });   // al volver a la pestaña, traer cambios de otra PC
  initAuth().then(() => {
    // regreso desde Patreon: avisar el resultado y mostrar el plan actualizado
    const r = takePatreonReturn();
    if (!r) return;
    toast(r.message, r.status === 'error' ? 'err' : r.status === 'ok' ? 'ok' : undefined);
    if (r.status === 'ok') refreshPlan().then(() => openAccount());
  });
}
