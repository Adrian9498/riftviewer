// La página informativa (riftviewer.com): lleva a la app en /app/ y manda ahí los enlaces viejos.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const redirect = html.match(/<script>([\s\S]*?)<\/script>/)![1];
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
