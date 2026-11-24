// La página informativa (riftviewer.com): lleva a la app en /app/ y manda ahí los enlaces viejos.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EN } from '../src/i18n/en';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const redirect = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('location.replace'))!;
/** corre el script del <head> con una dirección de prueba y devuelve a dónde manda (o null) */
function goesTo(hash: string): string | null {
  let to: string | null = null;
  new Function('location', redirect)({ hash, replace: (u: string) => { to = u; } });
  return to;
}

describe('textos y créditos', () => {
  const app = readFileSync(resolve(process.cwd(), 'app/index.html'), 'utf8');
  it('no se menciona RiftAtlas en las páginas (se habla del "simulador")', () => {
    expect(html).not.toMatch(/riftatlas/i);
    expect(app).not.toMatch(/riftatlas/i);
    expect(app).toContain('simulador');
  });
  it('donde hay cartas se acredita a las APIs públicas (Riftcodex, OpenRift y TCGCSV)', () => {
    const credits = app.match(/<p class="credits[^"]*">[\s\S]*?<\/p>/g) || [];
    expect(credits.length).toBe(4);                 // inicio, constructor, colección y escáner
    for (const c of credits) {
      expect(c).toContain('https://riftcodex.com');
      expect(c).toContain('https://openrift.app');
      expect(c).toContain('https://tcgcsv.com');
    }
    expect(html).toContain('https://riftcodex.com');
  });
});

describe('página informativa', () => {
  it('los botones llevan a la app en /app/', () => {
    expect((html.match(/href="app\/"/g) || []).length).toBeGreaterThanOrEqual(3);
  });
  it('dice que es un proyecto de fans no afiliado a Riot', () => {
    expect(html).toMatch(/no está afiliado[^<]*Riot Games/);
  });
  it('los enlaces viejos de la app (mazo compartido o sección) siguen funcionando', () => {
    expect(goesTo('#deck=abc123')).toBe('app/#deck=abc123');
    expect(goesTo('#/mazos')).toBe('app/#/mazos');
    expect(goesTo('#funciones')).toBeNull();     // los enlaces internos de la página se quedan aquí
    expect(goesTo('')).toBeNull();
  });
});

describe('SEO', () => {
  const app = readFileSync(resolve(process.cwd(), 'app/index.html'), 'utf8');
  const pub = (f: string) => readFileSync(resolve(process.cwd(), 'public', f), 'utf8');
  const meta = (name: string) => html.match(new RegExp(`<meta (?:name|property)="${name}" content="([^"]*)"`))?.[1];

  it('título, descripción y dirección canónica', () => {
    const title = html.match(/<title>([^<]*)<\/title>/)![1];
    expect(title).toContain('Riftbound');
    expect(title.length).toBeLessThanOrEqual(65);
    const d = meta('description')!;
    expect(d.length).toBeGreaterThan(70);
    expect(d.length).toBeLessThanOrEqual(165);
    expect(html).toContain('<link rel="canonical" href="https://riftviewer.com/">');
  });
  it('vista previa para redes con imagen de 1200×630', () => {
    expect(meta('og:image')).toBe('https://riftviewer.com/og-image.png');
    expect(meta('twitter:card')).toBe('summary_large_image');
    expect(meta('og:url')).toBe('https://riftviewer.com/');
  });
  it('datos estructurados válidos, y las preguntas son las de la página (en inglés, el idioma principal)', () => {
    const j = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    const faq = j['@graph'].find((x: { '@type': string }) => x['@type'] === 'FAQPage');
    const visible = [...html.matchAll(/<summary>([^<]*)<\/summary>/g)].map(m => EN[m[1]]);
    expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(visible);
    expect(j['@graph'].some((x: { '@type': string }) => x['@type'] === 'WebApplication')).toBe(true);
  });
  it('la app (beta cerrada) no se indexa; la página sí, con su sitemap', () => {
    expect(app).toContain('<meta name="robots" content="noindex">');
    expect(pub('robots.txt')).toMatch(/Disallow: \/app\//);
    expect(pub('robots.txt')).toContain('Sitemap: https://riftviewer.com/sitemap.xml');
    expect(pub('sitemap.xml')).toContain('<loc>https://riftviewer.com/</loc>');
    expect(JSON.parse(pub('manifest.webmanifest')).start_url).toBe('/app/');
  });
});
