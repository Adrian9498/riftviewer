// Traducción al vuelo de la página: cuando el idioma es inglés, cada texto y título que aparece en la página
// y coincide con una frase del diccionario (completa, o con huecos {0}) se cambia por su traducción.
// Así la mayoría de los textos fijos del HTML y de las plantillas no necesitan pasar por t().
// No toca lo que escribe la persona (cajas de texto, editores) ni lo marcado con translate="no".
import { EN } from './en';
import { LANG } from './i18n';

type Pat = { re: RegExp; to: string; order: number[]; lit: string };
let exact: Map<string, string> | null = null;
let pats: Pat[] = [];

function build() {
  exact = new Map();
  pats = [];
  for (const [es, en] of Object.entries(EN)) {
    if (!/\{\d+\}/.test(es)) { exact.set(es, en); continue; }
    // con huecos: se vuelve un patrón; cada hueco atrapa lo que sea
    const order: number[] = [];
    const src = es.split(/(\{\d+\})/).map(p => {
      const m = p.match(/^\{(\d+)\}$/);
      if (m) { order.push(+m[1]); return '([\\s\\S]+?)'; }
      return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    // el trozo fijo más largo: un filtro rápido antes de probar el patrón
    const lit = es.split(/\{\d+\}/).sort((a, b) => b.length - a.length)[0];
    pats.push({ re: new RegExp(`^${src}$`), to: en, order, lit });
  }
  // los más largos primero: son los más específicos
  pats.sort((a, b) => b.re.source.length - a.re.source.length);
}

function lookup(core: string, depth: number): string | null {
  const hit = exact!.get(core);
  if (hit != null) return hit;
  for (const p of pats) {
    if (!core.includes(p.lit)) continue;
    const m = core.match(p.re);
    if (!m) continue;
    const vals: string[] = [];
    p.order.forEach((idx, k) => { vals[idx] = m[k + 1]; });
    // lo que cae en un hueco puede ser también una frase conocida ("Victoria", "hace 3 d"…)
    return p.to.replace(/\{(\d+)\}/g, (_, i) => {
      const v = vals[+i] ?? '';
      return (depth < 2 && /[a-záéíóúñ]/i.test(v) ? lookup(v.trim(), depth + 1) : null) ?? v;
    });
  }
  // un separador suelto al principio o al final ("12 pasos ·", "· te faltan 3")
  const sep = depth < 2 && core.match(/^(·\s+)?([\s\S]*?)(\s+·)?$/);
  if (sep && (sep[1] || sep[3]) && sep[2]) {
    const r = lookup(sep[2], depth + 1);
    if (r != null) return (sep[1] || '') + r + (sep[3] || '');
  }
  // frases unidas con " · ": cada parte por su lado
  if (depth < 2 && core.includes(' · ')) {
    let changed = false;
    const parts = core.split(' · ').map(p => { const r = p.trim() ? lookup(p.trim(), depth + 1) : null; if (r != null) changed = true; return r ?? p; });
    if (changed) return parts.join(' · ');
  }
  return null;
}

/** La traducción de un texto que se ve en la página, o null si no está en el diccionario. */
export function translateText(s: string): string | null {
  if (LANG !== 'en') return null;
  if (!exact) build();
  const core = s.trim();
  if (!core || !/[a-záéíóúñ¿¡]/i.test(core)) return null;
  const out = lookup(core, 0);
  if (out == null || out === core) return null;
  const lead = s.match(/^\s*/)![0], tail = s.match(/\s*$/)![0];
  return lead + out + tail;
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CODE', 'PRE', 'svg', 'SVG']);
const ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'data-tip'];

const skipped = (el: Element | null) => !!el?.closest('[translate="no"],[contenteditable=""],[contenteditable="true"]');

function doAttrs(el: Element) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const tr = translateText(v);
    if (tr != null) el.setAttribute(a, tr);
  }
  // los botones tipo <input type="button" value="…">
  if (el instanceof HTMLInputElement && (el.type === 'button' || el.type === 'submit') && el.value) {
    const tr = translateText(el.value);
    if (tr != null) el.value = tr;
  }
}

/** Traduce un nodo y todo lo que tiene adentro. */
export function translateTree(root: Node) {
  if (root.nodeType === 3) { doText(root as Text); return; }
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  const el = root.nodeType === 1 ? root as Element : null;
  if (el?.tagName === 'TEXTAREA' && !skipped(el)) { doAttrs(el); return; }
  if (el && (SKIP.has(el.tagName) || skipped(el))) return;
  if (el) doAttrs(el);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (n.nodeType === 1) {
        const e = n as Element;
        // en una caja de texto se traduce su ayuda (placeholder, title), nunca lo escrito
        if (e.tagName === 'TEXTAREA') { doAttrs(e); return NodeFilter.FILTER_REJECT; }
        if (SKIP.has(e.tagName) || e.getAttribute('translate') === 'no' || e.getAttribute('contenteditable') === 'true' || e.getAttribute('contenteditable') === '') return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Node | null = walker.nextNode();
  while (n) {
    if (n.nodeType === 3) doText(n as Text);
    else {
      doAttrs(n as Element);
      if ((n as Element).tagName === 'TEMPLATE') translateTree((n as HTMLTemplateElement).content);
    }
    n = walker.nextNode();
  }
}

function doText(n: Text) {
  const p = n.parentElement;
  if (p && (SKIP.has(p.tagName) || skipped(p))) return;
  const tr = translateText(n.data);
  if (tr != null) n.data = tr;
}

let started = false;
/** Con el idioma en inglés, traduce la página ahora y todo lo que aparezca después. */
export function startDomTranslation(): void {
  if (started || LANG !== 'en' || typeof document === 'undefined') return;
  started = true;
  document.documentElement.lang = 'en';
  const tt = translateText(document.title); if (tt) document.title = tt;
  document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]').forEach(m => {
    const v = translateText(m.getAttribute('content') || ''); if (v) m.setAttribute('content', v);
  });
  translateTree(document.body);
  new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'childList') m.addedNodes.forEach(translateTree);
      else if (m.type === 'characterData') doText(m.target as Text);
      else if (m.type === 'attributes' && m.target.nodeType === 1 && !skipped(m.target as Element)) doAttrs(m.target as Element);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  document.documentElement.classList.remove('i18n-wait');
}
