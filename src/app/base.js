// Generado a partir de legacy/app.js (sección "base").


export const API ='https://api.riftcodex.com';
/** Archivos de public/ (catálogo, huellas): la app vive en /app/ y ellos en la raíz del sitio. */
export const pub = f => '../' + f;
export const $ = s => document.querySelector(s);
/** ¿Es un teléfono? (pantalla angosta, o táctil y chica). Sin matchMedia (pruebas) se asume PC. */
export const isPhone = () => typeof matchMedia === 'function' &&
  (matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse) and (max-height: 500px)').matches);
/** Formato guardado en este dispositivo: el teléfono guarda el suyo aparte (9:16 por defecto) y no se sincroniza. */
export const FMT_KEY = () => isPhone() ? 'rb_fmt_m' : 'rb_fmt';
export const stage = $('#stage');
/** icono del set SVG de index.html (#i-…) */
export const ic = n => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;