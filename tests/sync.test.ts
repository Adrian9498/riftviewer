import { describe, expect, it } from 'vitest';
import { planSync, storageName, toIso, toMs } from '../src/cloud/merge';

type Item = { key: string; ts: number; deleted?: boolean };
const keys = (xs: Item[]) => xs.map(x => x.key).sort();

describe('planSync (gana el cambio más reciente)', () => {
  it('sube lo que solo existe en local y baja lo que solo existe en la nube', () => {
    const p = planSync<Item, Item>([{ key: 'a', ts: 1 }], [{ key: 'b', ts: 1 }]);
    expect(keys(p.push)).toEqual(['a']);
    expect(keys(p.pull)).toEqual(['b']);
    expect(p.removeLocal).toEqual([]);
  });

  it('compara fechas cuando existe en ambos lados', () => {
    const p = planSync<Item, Item>([{ key: 'nuevo-local', ts: 5 }, { key: 'igual', ts: 3 }, { key: 'viejo-local', ts: 1 }],
      [{ key: 'nuevo-local', ts: 4 }, { key: 'igual', ts: 3 }, { key: 'viejo-local', ts: 2 }]);
    expect(keys(p.push)).toEqual(['nuevo-local']);
    expect(keys(p.pull)).toEqual(['viejo-local']);
  });

  it('propaga borrados: lápida local más nueva se sube; lápida remota más nueva borra en local', () => {
    const p = planSync<Item, Item>(
      [{ key: 'borrado-aqui', ts: 9, deleted: true }, { key: 'borrado-alla', ts: 1 }],
      [{ key: 'borrado-aqui', ts: 5 }, { key: 'borrado-alla', ts: 7, deleted: true }]);
    expect(keys(p.push)).toEqual(['borrado-aqui']);
    expect(keys(p.removeLocal)).toEqual(['borrado-alla']);
    expect(p.pull).toEqual([]);
  });

  it('ignora lápidas remotas de cosas que no existen en local', () => {
    const p = planSync<Item, Item>([], [{ key: 'x', ts: 3, deleted: true }]);
    expect(p).toEqual({ push: [], pull: [], removeLocal: [] });
  });

  it('si un elemento borrado vuelve a crearse, gana la versión más reciente', () => {
    const p = planSync<Item, Item>([{ key: 'x', ts: 10 }], [{ key: 'x', ts: 4, deleted: true }]);
    expect(keys(p.push)).toEqual(['x']);
  });

  it('limita cuántos elementos nuevos baja, empezando por los más recientes', () => {
    const remote = [1, 5, 3, 9, 7].map(ts => ({ key: 'k' + ts, ts }));
    expect(keys(planSync<Item, Item>([], remote, 2).pull)).toEqual(['k7', 'k9']);
  });
});

describe('utilidades de la nube', () => {
  it('convierte fechas en ambos sentidos', () => {
    expect(toMs(toIso(1700000000000))).toBe(1700000000000);
    expect(toMs(null)).toBe(0);
  });
  it('genera nombres de archivo seguros y distintos para claves parecidas', () => {
    const a = storageName('card:RAD-164'), b = storageName('card_RAD-164');
    expect(a).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(a).not.toBe(b);
  });
});
