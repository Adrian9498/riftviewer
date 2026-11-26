// Guías de especialista: cada carta nombrada existe, los números cuadran y la página sale en los dos idiomas.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeDeck } from '../src/deck/format';
import { GUIDES } from '../src/guides/index';
import { buildGuidePage, catalog, pageGuide } from '../src/guides/page';
import { curve, renderGuide, sampleDeck } from '../src/guides/render';
import type { Guide } from '../src/guides/types';

const { find } = catalog();
const names = (g: Guide) => {
  const out = new Set<string>([g.legend, g.champion, ...Object.keys(g.sample.main), ...Object.keys(g.sample.side), ...Object.keys(g.sample.runes), ...g.sample.battlefields]);
  for (const c of [...g.core, ...g.flex, ...g.side, ...g.battlefields]) out.add(c.name);
  for (const l of ['en', 'es'] as const) for (const s of g.sections[l]) for (const t of [...s.p, ...(s.list || [])]) for (const m of t.matchAll(/\[\[([^\]]+)\]\]/g)) out.add(m[1]);
  return [...out];
};
const total = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

describe.each(GUIDES)('guía de $short', g => {
  it('todas las cartas que menciona existen en el catálogo', () => {
    expect(names(g).filter(n => !find(n))).toEqual([]);
  });
  it('la lista de ejemplo es legal en tamaño: 40 con el campeón, 12 runas y 3 campos', () => {
    expect(total(g.sample.main) + 1).toBe(40);
    expect(total(g.sample.runes)).toBe(12);
    expect(g.sample.battlefields).toHaveLength(3);
  });
  it('el enlace del constructor abre la misma lista', () => {
    const d = sampleDeck(g, find);
    const html = renderGuide(g, 'en', find);
    const code = html.match(/#deck=([\w-]+)/)![1];
    const back = decodeDeck(code, 'x')!;
    expect(back.legend).toBe(d.legend);
    expect(back.champion).toBe(d.champion);
    expect(back.main).toEqual(d.main);
    expect(back.battlefields).toEqual(d.battlefields);
  });
  it('los números de las tablas no pasan del total de listas', () => {
    for (const c of [...g.core, ...g.flex, ...g.side, ...g.battlefields]) expect(c.lists).toBeLessThanOrEqual(g.studied.main);
    // el core es lo que está en al menos 90% de las listas
    for (const c of g.core) expect(c.lists / g.studied.main).toBeGreaterThanOrEqual(0.9);
    expect(g.sources).toHaveLength(g.studied.total);
    expect(g.sources.filter(s => s.meta === g.studied.mainMeta)).toHaveLength(g.studied.main);
    expect(g.sources.every(s => s.date >= g.since)).toBe(true);
  });
  it('las dos versiones tienen las mismas secciones', () => {
    expect(g.sections.en.map(s => s.id)).toEqual(g.sections.es.map(s => s.id));
  });
  it.each(['en', 'es'] as const)('la página en %s tiene su dirección, su idioma y sus etiquetas para buscadores', lang => {
    const file = `${lang === 'es' ? 'es/' : ''}guides/${g.slug}/index.html`;
    const tpl = readFileSync(resolve(process.cwd(), file), 'utf8');
    const p = pageGuide('/x/' + file)!;
    expect(p).toEqual({ guide: g, lang });
    const html = buildGuidePage(tpl, p);
    const url = `https://riftviewer.com${lang === 'es' ? '/es' : ''}/guides/${g.slug}/`;
    expect(html).toContain(`<html lang="${lang}">`);
    expect(html).toContain(`<title>${g.seoTitle[lang].replace(/&/g, "&amp;")}</title>`);
    expect(g.seoTitle[lang].length).toBeLessThanOrEqual(65);
    expect(g.description[lang].length).toBeLessThanOrEqual(170);
    expect(html).toContain(`<link rel="canonical" href="${url}">`);
    expect(html).toContain(`<link rel="alternate" hreflang="en" href="https://riftviewer.com/guides/${g.slug}/">`);
    expect(html).toContain(`<link rel="alternate" hreflang="es" href="https://riftviewer.com/es/guides/${g.slug}/">`);
    expect(html).toContain('hreflang="x-default"');
    // solo un idioma por página, y un solo h1
    expect(html).toContain(`<article class="guide" lang="${lang}">`);
    expect(html).not.toContain(`<article class="guide" lang="${lang === 'en' ? 'es' : 'en'}">`);
    expect(html.match(/<h1>/g)).toHaveLength(1);
    // las tablas del core salen una sola vez
    expect(html.split('id="' + (lang === 'es' ? 'es-' : '') + 'lists"')).toHaveLength(2);
    expect(html).toContain('og:image" content="https://openrift.app/');
    expect(html).toContain('<script type="module" src="/src/guides/main.ts"></script>');
    expect(html).not.toContain('<!--guide-');
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    const types = ld['@graph'].map((x: { '@type': string }) => x['@type']);
    expect(types).toEqual(['Article', 'BreadcrumbList', 'Organization']);
    expect(ld['@graph'][0]).toMatchObject({ inLanguage: lang, url, dateModified: g.updated, datePublished: g.published });
  });
  it('las rutas relativas llegan a la raíz del sitio desde cada idioma', () => {
    const tpl = readFileSync(resolve(process.cwd(), `guides/${g.slug}/index.html`), 'utf8');
    expect(buildGuidePage(tpl, { guide: g, lang: 'en' })).toContain('href="../../app/#/inicio"');
    expect(buildGuidePage(tpl, { guide: g, lang: 'es' })).toContain('href="../../../app/#/inicio"');
    expect(buildGuidePage(tpl, { guide: g, lang: 'es' })).toContain('data-src="../../../app/?embed=1#play=');
    expect(buildGuidePage(tpl, { guide: g, lang: 'en' })).toContain(`href="../../es/guides/${g.slug}/"`);
    expect(buildGuidePage(tpl, { guide: g, lang: 'es' })).toContain(`href="../../../guides/${g.slug}/"`);
  });
});

describe('índice de guías', () => {
  it('enlaza las guías publicadas y muestra las demás leyendas como próximamente', () => {
    const tpl = readFileSync(resolve(process.cwd(), 'guides/index.html'), 'utf8');
    const en = buildGuidePage(tpl, pageGuide('/x/guides/index.html')!);
    const es = buildGuidePage(readFileSync(resolve(process.cwd(), 'es/guides/index.html'), 'utf8'), pageGuide('/x/es/guides/index.html')!);
    for (const g of GUIDES) { expect(en).toContain(`href="${g.slug}/"`); expect(es).toContain(`href="${g.slug}/"`); }
    expect(en).toContain('Coming soon');
    expect(es).toContain('Próximamente');
    expect(es).toContain('<link rel="canonical" href="https://riftviewer.com/es/guides/">');
    expect(JSON.parse(en.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1])['@graph'][0]['@type']).toBe('CollectionPage');
  });
  it('las páginas que no son de guías se dejan en paz', () => {
    expect(pageGuide('/x/app/index.html')).toBeUndefined();
    expect(pageGuide('/x/index.html')).toBeUndefined();
  });
});

describe('guías en el sitio', () => {
  const read = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8');
  it('cada guía está en el sitemap y la landing enlaza al índice', () => {
    const map = read('public/sitemap.xml');
    for (const p of ['', ...GUIDES.map(g => g.slug + '/')]) {
      expect(map).toContain(`<loc>https://riftviewer.com/guides/${p}</loc>`);
      expect(map).toContain(`<loc>https://riftviewer.com/es/guides/${p}</loc>`);
      expect(map).toContain(`hreflang="es" href="https://riftviewer.com/es/guides/${p}"`);
    }
    expect(read('index.html')).toContain('href="guides/"');
  });
});

describe.each(GUIDES)('jugadas animadas de $short', g => {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const cat = JSON.parse(readFileSync(resolve(process.cwd(), 'public/openrift-catalog.json'), 'utf8'));
  const known = Object.values(cat.cards as Record<string, { name: string }>).map(c => norm(c.name));
  // "Diana - Scorn of the Moon": en riftcodex las leyendas llevan el campeón delante
  const exists = (n: string) => known.some(k => k === norm(n) || norm(n).endsWith(' ' + k));

  it.each(g.plays.flatMap(p => (['en', 'es'] as const).map(l => [p.id, l, p.script[l]] as const)))('%s (%s): el guion se lee sin errores y sus cartas existen', async (_id, _l, script) => {
    const { parse } = await import('../src/script/parser');
    const { steps, errors } = parse(script);
    expect(errors).toEqual([]);
    expect(steps.length).toBeGreaterThan(10);
    const cards = steps.filter(s => !['jugador', 'texto', 'fase', 'campo'].includes(s.cmd) && s.q).map(s => s.q!);
    expect(cards.filter(n => !exists(n))).toEqual([]);
  });
  it('las dos versiones de cada jugada hacen lo mismo (solo cambian los textos)', async () => {
    const { parse } = await import('../src/script/parser');
    for (const p of g.plays) {
      const shape = (s: string) => parse(s).steps.filter(x => !['texto', 'fase', 'jugador'].includes(x.cmd)).map(x => [x.cmd, x.q, x.pl, x.dest, x.num].join('|'));
      expect(shape(p.script.es)).toEqual(shape(p.script.en));
    }
  });
  it('cada jugada abre la app incrustada con su guion', () => {
    const html = renderGuide(g, 'en', find);
    const srcs = [...html.matchAll(/data-src="([^"]+)"/g)].map(m => m[1]);
    expect(srcs).toHaveLength(g.plays.length);
    srcs.forEach((src, i) => {
      expect(src.startsWith('../../app/?embed=1#play=')).toBe(true);
      const b = atob(src.split('#play=')[1].replace(/-/g, '+').replace(/_/g, '/'));
      expect(new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0)))).toBe(g.plays[i].script.en);
    });
  });
  it('la curva cuenta las 40 cartas del mazo principal', () => {
    expect(curve(g, find).reduce((a, b) => a + b, 0)).toBe(40);
  });
});

describe('anclas', () => {
  it.each(['en', 'es'] as const)('la página en %s no repite ids y sus enlaces internos existen', lang => {
    const g = GUIDES[0];
    const tpl = readFileSync(resolve(process.cwd(), `guides/${g.slug}/index.html`), 'utf8');
    const html = buildGuidePage(tpl, { guide: g, lang });
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    expect(ids.length).toBe(new Set(ids).size);
    for (const m of html.matchAll(/href="#([^"]+)"/g)) expect(ids).toContain(m[1]);
  });
});
