// Arma las páginas de guías al compilar: cambia los marcadores <!--guide-head--> y <!--guide-body--> del HTML
// por las etiquetas del <head> y los artículos en inglés y en español (se muestra uno según el idioma).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cardKey, guideCards, legendNames } from './catalog';
import { GUIDES } from './index';
import { renderGuide, renderIndex, type CardFinder } from './render';
import type { Guide } from './types';

const SITE = 'https://riftviewer.com';
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

let cache: { find: CardFinder; legends: ReturnType<typeof legendNames> } | null = null;
export function catalog(root = process.cwd()) {
  if (cache) return cache;
  const cat = JSON.parse(readFileSync(resolve(root, 'public/openrift-catalog.json'), 'utf8'));
  const cards = guideCards(cat);
  cache = { find: (name: string) => cards.get(cardKey(name)), legends: legendNames(cat) };
  return cache;
}

function head(title: string, desc: string, path: string, extra = '') {
  const url = SITE + path;
  return `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Riftviewer">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="guide-es-title" content="${esc(extra)}">`;
}

function guideHead(g: Guide) {
  const title = `${g.title.en} · Riftviewer`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: g.title.en, description: g.description.en,
    dateModified: g.updated, inLanguage: 'en', url: `${SITE}/guides/${g.slug}/`,
    publisher: { '@type': 'Organization', name: 'Riftviewer', url: SITE + '/' },
  };
  return head(title, g.description.en, `/guides/${g.slug}/`, `${g.title.es} · Riftviewer`)
    + `\n<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
}

/** ¿Qué guía es esta página? null = el índice; undefined = no es una página de guías. */
export function pageGuide(file: string): Guide | null | undefined {
  const m = file.replace(/\\/g, '/').match(/\/guides\/(?:([\w-]+)\/)?index\.html$/);
  if (!m) return undefined;
  if (!m[1]) return null;
  const g = GUIDES.find(x => x.slug === m[1]);
  if (!g) throw new Error(`No hay guía "${m[1]}" en src/guides/index.ts`);
  return g;
}

/** El HTML de una página de guías ya armado. */
export function buildGuidePage(html: string, g: Guide | null, root?: string): string {
  const { find, legends } = catalog(root);
  const both = (f: (l: 'en' | 'es') => string) => `<div class="g-en">${f('en')}</div><div class="g-es">${f('es')}</div>`;
  if (!g) {
    return html
      .replace('<!--guide-head-->', head('Riftbound legend guides · Riftviewer', 'Specialist guides for every Riftbound legend: the core cards from real tournament lists, game plan, mulligan and sideboard.', '/guides/', 'Guías de leyendas de Riftbound · Riftviewer'))
      .replace('<!--guide-body-->', both(l => renderIndex(GUIDES, legends, l, find)));
  }
  return html.replace('<!--guide-head-->', guideHead(g)).replace('<!--guide-body-->', both(l => renderGuide(g, l, find)));
}
