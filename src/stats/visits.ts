// Contador de visitas con GoatCounter: sin cookies ni datos personales, así que no necesita aviso de consentimiento.
// Se configura con una variable de compilación (pública):
//   VITE_GOATCOUNTER  el código de tu sitio en GoatCounter ("riftviewer" → riftviewer.goatcounter.com)
// Sin ella no se carga nada. Cuenta solo la página (/, /app/, /carpeta/…), nunca lo que va después de "#"
// (así el enlace de cada carpeta pública no queda registrado).

const CODE = (import.meta.env.VITE_GOATCOUNTER as string | undefined)?.trim() || '';

/** El código válido de GoatCounter (minúsculas, números y guiones) o '' si no hay. Acepta también la dirección completa. */
export function goatCode(raw = CODE): string {
  const c = raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\.goatcounter\.com.*$/, '');
  return /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(c) ? c : '';
}

let started = false;
/** Carga el contador una vez por página. Devuelve true si lo cargó. */
export function startVisits(raw = CODE, host = typeof location === 'undefined' ? '' : location.hostname): boolean {
  const code = goatCode(raw);
  if (started || !code || typeof document === 'undefined') return false;
  // en tu propia compu (localhost) no cuenta
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(host)) return false;
  started = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${code}.goatcounter.com/count`;
  document.head.appendChild(s);
  return true;
}
