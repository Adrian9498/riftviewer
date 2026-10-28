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
