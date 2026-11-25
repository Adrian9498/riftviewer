// Guías de especialista: cada carta nombrada existe, los números cuadran y la página sale en los dos idiomas.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeDeck } from '../src/deck/format';
import { GUIDES } from '../src/guides/index';
import { buildGuidePage, catalog, pageGuide } from '../src/guides/page';
import { renderGuide, sampleDeck } from '../src/guides/render';
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
  it('la página trae el título, la descripción y las dos versiones', () => {
    const tpl = readFileSync(resolve(process.cwd(), `guides/${g.slug}/index.html`), 'utf8');
    const html = buildGuidePage(tpl, pageGuide(`/x/guides/${g.slug}/index.html`)!);
    expect(html).toContain(`<title>${g.title.en} · Riftviewer</title>`);
    expect(html).toContain(`<link rel="canonical" href="https://riftviewer.com/guides/${g.slug}/">`);
    expect(html).toContain('<div class="g-en"><article class="guide" lang="en">');
    expect(html).toContain('<div class="g-es"><article class="guide" lang="es">');
    expect(html).not.toContain('<!--guide-');
    JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
  });
});

describe('índice de guías', () => {
  it('enlaza las guías publicadas y muestra las demás leyendas como próximamente', () => {
    const tpl = readFileSync(resolve(process.cwd(), 'guides/index.html'), 'utf8');
    const html = buildGuidePage(tpl, pageGuide('/x/guides/index.html')!);
    for (const g of GUIDES) expect(html).toContain(`href="${g.slug}/"`);
    expect(html).toContain('Coming soon');
    expect(html).toContain('Próximamente');
  });
  it('las páginas que no son de guías se dejan en paz', () => {
    expect(pageGuide('/x/app/index.html')).toBeUndefined();
    expect(pageGuide('/x/index.html')).toBeUndefined();
  });
});

describe('guías en el sitio', () => {
  const read = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8');
  it('cada guía está en el sitemap y la landing enlaza al índice', () => {
    expect(read('public/sitemap.xml')).toContain('<loc>https://riftviewer.com/guides/</loc>');
    for (const g of GUIDES) expect(read('public/sitemap.xml')).toContain(`<loc>https://riftviewer.com/guides/${g.slug}/</loc>`);
    expect(read('index.html')).toContain('href="guides/"');
  });
});
