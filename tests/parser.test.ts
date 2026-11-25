import { describe, expect, it } from 'vitest';
import { isSetup, parse, playerOf, tokenize } from '../src/script/parser';

describe('tokenize', () => {
  it('separa palabras y respeta textos entre comillas', () => {
    expect(tokenize('juega j1 "Jinx - Rebel" a base')).toEqual([{ w: 'juega' }, { w: 'j1' }, { q: 'Jinx - Rebel' }, { w: 'a' }, { w: 'base' }]);
  });
});

describe('parse', () => {
  it('reconoce jugador, carta y destino', () => {
    const { steps, errors } = parse('juega j1 "Jinx - Rebel" a A');
    expect(errors).toEqual([]);
    expect(steps[0]).toMatchObject({ cmd: 'juega', line: 1, pl: 1, q: 'Jinx - Rebel', dest: 'A' });
  });

  it('ignora líneas vacías y comentarios, y numera por línea del archivo', () => {
    const { steps } = parse('# comentario\n\n// otro\nturno j2');
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ cmd: 'turno', line: 4, pl: 2 });
  });

  it('acepta acentos en el comando y conserva el signo del número', () => {
    const { steps, errors } = parse('daño "Poro" 3\npuntos j1 +1\nrunas j2 -2');
    expect(errors).toEqual([]);
    expect(steps.map(s => [s.cmd, s.num])).toEqual([['dano', '3'], ['puntos', '+1'], ['runas', '-2']]);
  });

  it('lee el campo en combate y conquista', () => {
    const { steps } = parse('combate b\nconquista j1 C');
    expect(steps.map(s => s.field)).toEqual(['B', 'C']);
  });

  it('informa errores con su número de línea', () => {
    const { steps, errors } = parse('volar j1\njuega "Poro"\nmueve j1 "Poro"\ncampo D "X"\npuntos j1');
    expect(steps).toHaveLength(4);
    expect(errors).toEqual([
      'Línea 1: comando desconocido "volar"',
      'Línea 2: falta el jugador (j1 o j2)',
      'Línea 3: falta el destino: a base / a A',
      'Línea 4: campo debe ser A, B o C',
      'Línea 5: falta un número',
    ]);
  });

  it('pide el nombre entre comillas donde hace falta', () => {
    expect(parse('texto hola').errors).toEqual(['Línea 1: falta el nombre entre comillas']);
    expect(parse('prepara j1 todo').errors).toEqual([]);
  });
});

describe('utilidades', () => {
  it('playerOf solo reconoce j1 y j2', () => {
    expect([playerOf('J1'), playerOf('j2'), playerOf('1'), playerOf(undefined)]).toEqual([1, 2, undefined, undefined]);
  });
  it('isSetup marca los comandos de configuración', () => {
    expect(isSetup({ cmd: 'campo' })).toBe(true);
    expect(isSetup({ cmd: 'juega' })).toBe(false);
  });
});

describe('mesa inicial y jugadas especiales', () => {
  it('"put" / "pon" acomoda la mesa: lugar, oculta y agotada', () => {
    const { steps, errors } = parse('put p1 "Tideturner" at A hidden\npon j2 "Gust" en descarte\nput p1 "Fizz" at hand exhausted');
    expect(errors).toEqual([]);
    expect(steps.map(s => [s.cmd, s.pl, s.q, s.dest])).toEqual([['pon', 1, 'Tideturner', 'A'], ['pon', 2, 'Gust', 'descarte'], ['pon', 1, 'Fizz', 'mano']]);
    expect(steps[0].words).toContain('oculta');
    expect(steps[2].words).toContain('agotada');
    expect(steps.every(isSetup)).toBe(true);
  });
  it('"put" sin lugar válido es un error', () => {
    expect(parse('put p1 "Gust"').errors).toHaveLength(1);
    expect(parse('put p1 "Gust" at deck').errors).toHaveLength(1);
  });
  it('"play … from trash recycle" se lee en inglés', () => {
    const s = parse('play p1 "Star-Crossed" from trash recycle').steps[0];
    expect(s.cmd).toBe('juega');
    expect(s.words).toEqual(['p1', 'desde', 'descarte', 'recicla']);
  });
});
