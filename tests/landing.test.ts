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
