// Idioma de Riftviewer: inglés por defecto, con opción de cambiar a español.
// Los textos del código están en español y sirven de clave: t('Guardar') → "Save" en inglés.
// Con {0}, {1}… se insertan valores: t('Versión {0}', n). Las traducciones viven en ./en.ts.
// Lo que se pinta en la página sin pasar por t() lo traduce ./dom.ts al vuelo (textos y títulos exactos).
import { EN } from './en';

export type Lang = 'en' | 'es';
const KEY = 'rb_lang';

function readLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'es' || v === 'en') return v;
  } catch { /* sin almacenamiento: el predeterminado */ }
  // las pruebas están escritas contra los textos en español
  if (import.meta.env?.MODE === 'test') return 'es';
  return 'en';
}

export let LANG: Lang = readLang();
/** El código regional para fechas y números. */
export const locale = () => (LANG === 'en' ? 'en-US' : 'es');

/** Solo para pruebas. */
export function __setLang(l: Lang) { LANG = l; }

/** Cambia el idioma y recarga la página para pintarla de nuevo. */
export function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* sin almacenamiento */ }
  location.reload();
}

const fill = (s: string, a: unknown[]) => a.length ? s.replace(/\{(\d+)\}/g, (m, i) => (a[+i] ?? m) as string) : s;

/** Traduce un texto escrito en español. */
export function t(es: string, ...args: unknown[]): string {
  return fill(LANG === 'en' ? (EN[es] ?? es) : es, args);
}

/** Singular o plural según n, ya traducido: tn(n, '{0} carta', '{0} cartas'). */
export function tn(n: number, one: string, many: string): string {
  return t(n === 1 ? one : many, n.toLocaleString(locale()));
}

/** El selector de idioma (dos botones), para la barra o el pie de cada página. */
export function langSwitchHTML(cls = 'langsw'): string {
  return `<span class="${cls}" translate="no" role="group" aria-label="Language / Idioma">`
    + `<button type="button" data-lang="en" class="${LANG === 'en' ? 'on' : ''}">EN</button>`
    + `<button type="button" data-lang="es" class="${LANG === 'es' ? 'on' : ''}">ES</button></span>`;
}

/** Escucha los clics en los selectores de idioma de la página. */
export function wireLangSwitch(root: Document | HTMLElement = document) {
  root.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest?.('[data-lang]') as HTMLElement | null;
    if (!b) return;
    const l = b.dataset.lang as Lang;
    if (l !== LANG) setLang(l);
  });
}

/** Alias de t() para usar donde "t" ya es una variable. */
export const _t = t;
