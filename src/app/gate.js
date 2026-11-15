// Pantalla de acceso de la beta cerrada: tapa la app hasta que entras con una cuenta invitada.
// Con la beta abierta (o sin Supabase configurado) no aparece nunca.
// Nota: esto es la puerta de la interfaz; el candado real está en Supabase (solo los invitados pueden crear cuenta
// y sus datos ya están protegidos por usuario).
import { cachedBeta, canUse, deniedByBeta, fetchBeta } from '../cloud/beta';
import { cloudEnabled } from '../cloud/client';
import { currentUser, displayName, onUserChange, signOut } from '../cloud/auth';
import { $, ic } from './base';
import { openAuth } from './account';
import { esc } from './utils';

let state = null, checking = null, again = false, deniedOAuth = false;

function show(on) {
  $('#gate').hidden = !on;
  document.body.classList.toggle('gated', on);
}
function render(mode) {
  const u = currentUser(), box = $('#gate .gbox');
  const head = `<span class="gmark"></span><h1>Riftviewer</h1><span class="gbadge"><span class="gdot"></span>Beta cerrada</span>`;
  if (mode === 'checking') { box.innerHTML = `${head}<p class="gsub">Comprobando tu acceso…</p>`; return; }
  if (u) {
    box.innerHTML = `${head}
      <p class="gsub">La cuenta <b>${esc(displayName(u))}</b> todavía no tiene invitación a la beta.</p>
      <p class="ghint">Si ya te invitamos con otro correo, cierra sesión y entra con ese.</p>
      <div class="gbtns"><button class="btn primary" data-g="retry">${ic('replay')} Volver a comprobar</button><button class="btn" data-g="out">Cerrar sesión</button></div>
      <a class="glink" href="../">Conocer Riftviewer</a>`;
    return;
  }
  box.innerHTML = `${head}
    <p class="gsub">Riftviewer está en beta cerrada. Entra con el correo de tu invitación.</p>
    ${deniedOAuth ? '<p class="gerr">Ese correo no tiene invitación a la beta.</p>' : ''}
    <div class="gbtns"><button class="btn primary" data-g="login">${ic('user')} Iniciar sesión</button><button class="btn" data-g="signup">Crear cuenta con mi invitación</button></div>
    <a class="glink" href="../">Conocer Riftviewer</a>`;
}
function apply(st) {
  state = st;
  if (canUse(st)) { show(false); return; }
  render(); show(true);
}
/**
 * Pregunta el estado. Una consulta a la vez: si la sesión cambia mientras tanto, se vuelve a preguntar al terminar.
 * Si no se puede saber, se usa lo último conocido.
 */
export function check() {
  if (checking) { again = true; return checking; }
  checking = fetchBeta().then(st => { apply(st ?? cachedBeta()); })
    .finally(() => { checking = null; if (again) { again = false; check(); } });
  return checking;
}

export function init() {
  if (!cloudEnabled) return;
  // antes de que la navegación limpie la dirección: ¿volvimos de Google/Discord sin invitación?
  deniedOAuth = deniedByBeta(location.href);
  // al abrir: lo último que se supo, para no parpadear; si no se sabe nada, se espera la respuesta
  const c = cachedBeta();
  if (c) apply(c); else { render('checking'); show(true); }
  $('#gate').addEventListener('click', async e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    const g = b.dataset.g;
    if (g === 'login' || g === 'signup') openAuth(g);
    else if (g === 'out') { await signOut().catch(() => {}); check(); }
    else if (g === 'retry') { render('checking'); check(); }
  });
  // cada cambio de sesión (entrar, salir, la sesión guardada al cargar) vuelve a preguntar
  onUserChange((u, ev) => { if (ev !== 'TOKEN_REFRESHED') check(); });
}
