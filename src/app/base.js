// Generado a partir de legacy/app.js (sección "base").


export const API ='https://api.riftcodex.com';
/** Archivos de public/ (catálogo, huellas): la app vive en /app/ y ellos en la raíz del sitio. */
export const pub = f => '../' + f;
export const $ = s => document.querySelector(s);
export const stage = $('#stage');
/** icono del set SVG de index.html (#i-…) */
export const ic = n => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;