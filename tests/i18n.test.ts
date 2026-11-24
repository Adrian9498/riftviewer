// @vitest-environment jsdom
// Idioma: inglés por defecto con opción de español. Las pruebas corren en español salvo que se cambie aquí.
import { afterEach, describe, expect, it } from 'vitest';
import { EN } from '../src/i18n/en';
import { __setLang, t, tn } from '../src/i18n/i18n';
import { translateText, translateTree } from '../src/i18n/dom';
import { parse } from '../src/script/parser';

afterEach(() => __setLang('es'));

describe('t()', () => {
  it('en español deja el texto y llena los huecos', () => {
    expect(t('Guardar')).toBe('Guardar');
    expect(t('Versión {0}', 3)).toBe('Versión 3');
  });
  it('en inglés traduce, y lo que no conoce lo deja igual', () => {
    __setLang('en');
    expect(t('Guardar')).toBe('Save');
    expect(t('Versión {0}', 3)).toBe('Version 3');
    expect(t('Algo que no está')).toBe('Algo que no está');
    expect(tn(1, '{0} carta', '{0} cartas')).toBe('1 card');
    expect(tn(3, '{0} carta', '{0} cartas')).toBe('3 cards');
  });
  it('cada traducción usa los mismos huecos que su original', () => {
    const holes = (s: string) => [...s.matchAll(/\{(\d+)\}/g)].map(m => m[1]).sort().join(',');
    const bad = Object.entries(EN).filter(([es, en]) => holes(es) !== holes(en)).map(([es]) => es);
    expect(bad).toEqual([]);
  });
});

describe('traducción de la página', () => {
  it('en español no toca nada', () => {
    expect(translateText('Guardar')).toBeNull();
  });
  it('frases exactas, con huecos, con " · " y con separadores sueltos', () => {
    __setLang('en');
    expect(translateText('  Guardar ')).toBe('  Save ');
    expect(translateText('12 cartas')).toBe('12 cards');
    expect(translateText('Editado hace 3 d')).toBe('Edited 3 d ago');
    expect(translateText('40 cartas · 12 runas')).toBe('40 cards · 12 runes');
    expect(translateText('12 pasos ·')).toBe('12 steps ·');
    expect(translateText('Línea 4: falta el número')).toBe('Line 4: falta el número');   // lo desconocido queda igual
    expect(translateText('Línea 4: falta un número')).toBe('Line 4: missing a number');
    expect(translateText('Jinx, Loose Cannon')).toBeNull();
  });
  it('recorre la página: textos y títulos, sin tocar cajas de texto ni lo marcado translate="no"', () => {
    __setLang('en');
    document.body.innerHTML = `<div><button title="Cerrar">Guardar</button><textarea>Guardar</textarea>
      <span translate="no">Guardar</span><p>Tienes <b>3</b> de 5</p><input placeholder="Nombre del mazo"></div>`;
    translateTree(document.body);
    const b = document.querySelector('button')!;
    expect(b.textContent).toBe('Save');
    expect(b.title).toBe('Close');
    expect(document.querySelector('textarea')!.value).toBe('Guardar');
    expect(document.querySelector('span')!.textContent).toBe('Guardar');
    expect((document.querySelector('input') as HTMLInputElement).placeholder).toBe('Deck name');
  });
});

describe('guion en inglés', () => {
  it('acepta los comandos en inglés igual que en español', () => {
    const en = parse('player p1 "Ana"\nplay p1 "Poro" to base\nmove p1 "Poro" to A\nready p1 all\nconquer p1 A\npoints p1 +1');
    const es = parse('jugador j1 "Ana"\njuega j1 "Poro" a base\nmueve j1 "Poro" a A\nprepara j1 todo\nconquista j1 A\npuntos j1 +1');
    expect(en.errors).toEqual([]);
    expect(en.steps.map(s => [s.cmd, s.pl, s.dest, s.field, s.q])).toEqual(es.steps.map(s => [s.cmd, s.pl, s.dest, s.field, s.q]));
  });
});
