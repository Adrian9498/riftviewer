import { describe, expect, it } from 'vitest';
import { computeCamera, padTarget, union } from '../src/replay/camera';
import { newBattles, scoreDeltas, zoneCards, type GameState } from '../src/replay/events';

const AREA = { x: 0, y: 0, w: 1920, h: 900 };

describe('cámara', () => {
  it('union cubre todos los rectángulos', () => {
    expect(union([{ x: 10, y: 20, w: 100, h: 50 }, { x: 200, y: 0, w: 10, h: 10 }])).toEqual({ x: 10, y: 0, w: 200, h: 70 });
  });

  it('padTarget agranda un objetivo pequeño manteniendo el centro', () => {
    const t = padTarget({ x: 900, y: 400, w: 100, h: 100 }, AREA);
    expect(t.w).toBeCloseTo(1920 * 0.36);
    expect(t.h).toBeCloseTo(900 * 0.32);
    expect(t.x + t.w / 2).toBe(950);
    expect(t.y + t.h / 2).toBe(450);
  });

  it('sin objetivo o en modo fijo muestra todo', () => {
    expect(computeCamera(null, AREA, 'suave')).toEqual({ s: 1, tx: 0, ty: 0 });
    expect(computeCamera({ x: 0, y: 0, w: 100, h: 100 }, AREA, 'off')).toEqual({ s: 1, tx: 0, ty: 0 });
  });

  it('respeta el acercamiento máximo de cada modo', () => {
    const small = { x: 900, y: 400, w: 50, h: 50 };
    expect(computeCamera(small, AREA, 'suave').s).toBe(1.6);
    expect(computeCamera(small, AREA, 'intensa').s).toBe(2.4);
  });

  it('nunca muestra fuera del tablero (se pega al borde)', () => {
    const corner = computeCamera({ x: 0, y: 0, w: 300, h: 200 }, AREA, 'suave');
    expect(corner.tx).toBe(0);
    expect(corner.ty).toBe(0);
    const far = computeCamera({ x: 1800, y: 850, w: 100, h: 40 }, AREA, 'suave');
    expect(far.tx).toBeCloseTo(AREA.w - AREA.w * far.s);
    expect(far.ty).toBeCloseTo(AREA.h - AREA.h * far.s);
  });

  it('si el objetivo es casi del tamaño del tablero no hace zoom', () => {
    expect(computeCamera({ x: 0, y: 0, w: 1800, h: 880 }, AREA, 'suave').s).toBe(1);
  });
});

describe('eventos del replay', () => {
  const st = (a: object, b: object): GameState => ({ players: [{ id: 'a', board: a as any }, { id: 'b', board: b as any }] });

  it('zoneCards acepta lista, objeto suelto o vacío', () => {
    expect(zoneCards([{ id: 'x' }, null, { foo: 1 }])).toEqual([{ id: 'x' }]);
    expect(zoneCards({ id: 'y' })).toEqual([{ id: 'y' }]);
    expect(zoneCards({})).toEqual([]);
    expect(zoneCards(undefined)).toEqual([]);
  });

  it('detecta el inicio de una batalla solo cuando un campo pasa a estar disputado', () => {
    const before = st({ battlefieldA: [{ id: 'u1' }] }, {});
    const after = st({ battlefieldA: [{ id: 'u1' }] }, { battlefieldA: { id: 'u2' } });
    expect(newBattles(before, after)).toEqual(['battlefieldA']);
    expect(newBattles(after, after)).toEqual([]);   // sigue disputado: no es nueva
    expect(newBattles(null, after)).toEqual([]);
  });

  it('calcula los puntos ganados o perdidos', () => {
    expect(scoreDeltas(st({ score: 2 }, { score: 1 }), st({ score: 3 }, { score: 1 }))).toEqual([{ id: 'a', delta: 1 }]);
    expect(scoreDeltas(null, st({ score: 3 }, {}))).toEqual([]);
  });
});
