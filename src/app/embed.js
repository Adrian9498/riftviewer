// Modo incrustado: app/?embed=1#play=<guion> reproduce un guion dentro de otra página (las jugadas de las guías).
// Solo el tablero y la barra de reproducción: sin pantalla de acceso, sin recorrido de bienvenida y sin guardar
// nada en "recientes". El guion va dentro del enlace (base64url).
import { EMBED } from './embed-flag.js';
import { openScript } from './shell.js';

export { EMBED };

/** El guion de un enlace #play=…, o null. */
export function playFromHash(hash) {
  const m = (hash || '').match(/^#play=([\w-]+)/);
  if (!m) return null;
  try {
    const b = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(b, ch => ch.charCodeAt(0)));
  } catch { return null; }
}

/** Guion → texto para #play= (lo usan las guías al compilar). */
export function playHash(text) {
  const bytes = new TextEncoder().encode(text);
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Se lee antes de arrancar la app (la navegación cambia la dirección al iniciar). */
const PENDING = EMBED && typeof location !== 'undefined' ? playFromHash(location.hash) : null;
if (EMBED && typeof document !== 'undefined') document.documentElement.classList.add('embed');

export function init() {
  if (!EMBED || !PENDING) return;
  const name = (PENDING.match(/^#\s*(.+)$/m)?.[1] || 'Riftviewer').trim();
  openScript(PENDING, name);
}
