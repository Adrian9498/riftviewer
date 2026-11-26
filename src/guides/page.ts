// Arma las páginas de guías al compilar. Cada idioma tiene su propia dirección (bueno para buscadores):
//   inglés   /guides/  y /guides/<leyenda>/
//   español  /es/guides/ y /es/guides/<leyenda>/
// El archivo HTML de cada página es solo un marcador (<!--guide-page-->): aquí se escribe el documento
// completo, con <head> para buscadores (hreflang, Open Graph, datos estructurados) y el artículo.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cardKey, guideCards, legendNames } from './catalog';
import { GUIDES } from './index';
import { renderGuide, renderIndex, type CardFinder } from './render';
import type { Guide, Lang } from './types';

export const SITE = 'https://riftviewer.com';
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const json = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

let cache: { find: CardFinder; legends: ReturnType<typeof legendNames> } | null = null;
export function catalog(root = process.cwd()) {
  if (cache) return cache;
  const cat = JSON.parse(readFileSync(resolve(root, 'public/openrift-catalog.json'), 'utf8'));
  const cards = guideCards(cat);
  cache = { find: (name: string) => cards.get(cardKey(name)), legends: legendNames(cat) };
  return cache;
}

/** Una página de guías: cuál guía (null = el índice) y en qué idioma. */
export interface GuidePage { guide: Guide | null; lang: Lang }

/** La dirección de una página (sin dominio): /guides/diana/, /es/guides/… */
export const guidePath = (slug: string | null, lang: Lang) => `${lang === 'es' ? '/es' : ''}/guides/${slug ? slug + '/' : ''}`;

/** ¿Qué página de guías es este archivo? undefined = no es una página de guías. */
export function pageGuide(file: string): GuidePage | undefined {
  const m = file.replace(/\\/g, '/').match(/\/(es\/)?guides\/(?:([\w-]+)\/)?index\.html$/);
  if (!m) return undefined;
  const lang: Lang = m[1] ? 'es' : 'en';
  if (!m[2]) return { guide: null, lang };
  const guide = GUIDES.find(x => x.slug === m[2]);
  if (!guide) throw new Error(`No hay guía "${m[2]}" en src/guides/index.ts`);
  return { guide, lang };
}

const CHROME = {
  en: { guides: 'Guides', app: 'Open the app', home: 'Home', tabs: [['inicio', 'Home'], ['mazos', 'Decks'], ['coleccion', 'Collection'], ['mesa', 'At the table'], ['intercambios', 'Trades']], sections: 'Sections', lists: 'Tournament lists:', imgs: '· card images:', tm: '. Riftbound is a trademark of Riot Games; Riftviewer is not affiliated with Riot Games.', privacy: 'Privacy', locale: 'en_US' },
  es: { guides: 'Guías', app: 'Abrir la app', home: 'Inicio', tabs: [['inicio', 'Inicio'], ['mazos', 'Mazos'], ['coleccion', 'Colección'], ['mesa', 'En la mesa'], ['intercambios', 'Intercambios']], sections: 'Secciones', lists: 'Listas de torneo:', imgs: '· imágenes de cartas:', tm: '. Riftbound es una marca de Riot Games; Riftviewer no está afiliado a Riot Games.', privacy: 'Privacidad', locale: 'es_MX' },
};

const INDEX = {
  en: { title: 'Riftbound Legend Deck Guides: Core Cards & Strategy | Riftviewer', desc: 'Specialist deck guides for every Riftbound legend, built from real tournament lists: core cards, game plan, mulligan, sideboard and animated key plays.' },
  es: { title: 'Guías de mazos por leyenda de Riftbound | Riftviewer', desc: 'Guías de especialista para cada leyenda de Riftbound, hechas con listas reales de torneo: cartas core, plan de juego, mulligan, banquillo y jugadas animadas.' },
};

function headTags(p: GuidePage, find: CardFinder): string {
  const { guide: g, lang } = p;
  const slug = g?.slug ?? null;
  const url = SITE + guidePath(slug, lang);
  const title = g ? g.seoTitle[lang] : INDEX[lang].title;
  const desc = g ? g.description[lang] : INDEX[lang].desc;
  const legendImg = g ? find(g.legend)?.img : undefined;
  const image = legendImg ?? `${SITE}/og-image.png`;
  const other: Lang = lang === 'en' ? 'es' : 'en';
  const c = CHROME[lang];
  const crumbs = [
    { name: 'Riftviewer', item: SITE + '/' },
    { name: c.guides, item: SITE + guidePath(null, lang) },
    ...(g ? [{ name: g.short, item: url }] : []),
  ];
  const breadcrumb = { '@type': 'BreadcrumbList', itemListElement: crumbs.map((x, i) => ({ '@type': 'ListItem', position: i + 1, ...x })) };
  const publisher = { '@type': 'Organization', '@id': SITE + '/#org', name: 'Riftviewer', url: SITE + '/', logo: { '@type': 'ImageObject', url: SITE + '/icon-512.png' } };
  const game = { '@type': 'Game', name: 'Riftbound', alternateName: 'Riftbound: League of Legends Trading Card Game' };
  const main = g
    ? {
      '@type': 'Article', '@id': url + '#guide', headline: g.title[lang], name: title, description: desc,
      image: legendImg ? [legendImg] : [image], datePublished: g.published, dateModified: g.updated,
      inLanguage: lang, url, mainEntityOfPage: url, author: { '@id': publisher['@id'] }, publisher: { '@id': publisher['@id'] },
      about: [game, { '@type': 'Thing', name: `${g.champion}` }], keywords: g.keywords[lang].join(', '),
      isPartOf: { '@type': 'CollectionPage', '@id': SITE + guidePath(null, lang) },
    }
    : {
      '@type': 'CollectionPage', '@id': url, name: title, description: desc, inLanguage: lang, url, about: game,
      mainEntity: { '@type': 'ItemList', itemListElement: GUIDES.map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + guidePath(x.slug, lang), name: x.title[lang] })) },
    };
  return `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="en" href="${SITE + guidePath(slug, 'en')}">
<link rel="alternate" hreflang="es" href="${SITE + guidePath(slug, 'es')}">
<link rel="alternate" hreflang="x-default" href="${SITE + guidePath(slug, 'en')}">
<meta property="og:type" content="${g ? 'article' : 'website'}">
<meta property="og:site_name" content="Riftviewer">
<meta property="og:locale" content="${c.locale}">
<meta property="og:locale:alternate" content="${CHROME[other].locale}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(g ? g.legend + ' · Riftbound' : 'Riftviewer')}">
${g ? `<meta property="article:published_time" content="${g.published}">\n<meta property="article:modified_time" content="${g.updated}">\n<meta property="article:section" content="Riftbound">\n` : ''}<meta name="twitter:card" content="${legendImg ? 'summary' : 'summary_large_image'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
${legendImg ? `<link rel="preload" as="image" href="${esc(legendImg)}" fetchpriority="high">\n` : ''}${json({ '@context': 'https://schema.org', '@graph': [main, breadcrumb, publisher] })}`;
}

/** El HTML completo de una página de guías. */
export function buildGuidePage(html: string, p: GuidePage, root?: string): string {
  if (!html.includes('<!--guide-page-->')) throw new Error('La plantilla de la guía necesita <!--guide-page-->');
  const { find, legends } = catalog(root);
  const { guide: g, lang } = p;
  const slug = g?.slug ?? null;
  // de esta página a la raíz del sitio: /guides/ → ../, /es/guides/diana/ → ../../../
  const up = '../'.repeat(guidePath(slug, lang).split('/').filter(Boolean).length);
  const other: Lang = lang === 'en' ? 'es' : 'en';
  const c = CHROME[lang];
  const toIndex = g ? '../' : './';
  const body = g ? renderGuide(g, lang, find, up + 'app/') : renderIndex(GUIDES, legends, lang, find);
  // el idioma elegido: al entrar a la versión en español se recuerda; en la inglesa, quien eligió español va a la suya
  const langScript = lang === 'es'
    ? `try{localStorage.setItem('rb_lang','es')}catch(e){}`
    : `try{if(localStorage.getItem('rb_lang')==='es')location.replace(${JSON.stringify(up + guidePath(slug, 'es').slice(1) + '')}+location.hash)}catch(e){}`;
  const sw = (l: Lang) => `<a data-lang="${l}" hreflang="${l}" lang="${l}" href="${up}${guidePath(slug, l).slice(1)}"${l === lang ? ' class="on" aria-current="true"' : ''}>${l.toUpperCase()}</a>`;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>${langScript}</script>
${headTags(p, find)}
<meta name="theme-color" content="#060b14">
<link rel="icon" type="image/png" sizes="32x32" href="${up}favicon-32.png">
<link rel="apple-touch-icon" href="${up}apple-touch-icon.png">
<link rel="manifest" href="${up}manifest.webmanifest">
<link rel="preconnect" href="https://openrift.app">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Marcellus+SC&family=Source+Sans+3:ital,wght@0,400..800;1,400..600&display=swap" rel="stylesheet">
</head>
<body>
<header class="gtop">
  <a class="gbrand" href="${up}"><span class="gmark"></span>Riftviewer</a>
  <nav class="gtabs" aria-label="${c.sections}">${c.tabs.map(([r, label]) => `<a href="${up}app/#/${r}">${label}</a>`).join('')}<a href="${toIndex}" class="on" aria-current="page">${c.guides}</a></nav>
  <span class="langsw" translate="no" role="group" aria-label="Language / Idioma">${sw('en')}${sw('es')}</span>
</header>
<nav class="gcrumbs" aria-label="Breadcrumb"><a href="${up}">${c.home}</a> › ${g ? `<a href="${toIndex}">${c.guides}</a> › <span aria-current="page">${esc(g.short)}</span>` : `<span aria-current="page">${c.guides}</span>`}</nav>
<main id="gmain">
${body}
</main>
<div id="gzoom" class="gzoom" hidden aria-hidden="true"><img alt=""></div>
<footer class="gfoot">${c.lists} <a href="https://riftdecks.com" target="_blank" rel="noopener">RiftDecks</a> ${c.imgs} <a href="https://openrift.app" target="_blank" rel="noopener">OpenRift</a>${c.tm} <a href="${up}privacidad.html">${c.privacy}</a> · <a href="${up}${guidePath(slug, other).slice(1)}" hreflang="${other}" lang="${other}">${other === 'es' ? 'Ver en español' : 'Read in English'}</a></footer>
<script type="module" src="/src/guides/main.ts"></script>
</body>
</html>
`;
}
