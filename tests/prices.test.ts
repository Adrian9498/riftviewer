// Precios: conversión de los productos de tcgcsv (TCGplayer) a códigos de carta, y lectura en la app.
import { describe, expect, it } from 'vitest';
import { codeFor, pricesForGroup } from '../supabase/functions/_shared/prices';
import { priceOf, collectionValue, historyPoints, money } from '../src/cloud/prices';

describe('tcgcsv → códigos', () => {
  it('arma el código desde el set y el número impreso', () => {
    expect(codeFor('OGN', '007a/298')).toBe('OGN-007A');
    expect(codeFor('RAD', 'R02')).toBe('RAD-R02');
    expect(codeFor('RAD', 'SP4/005')).toBe('RAD-SP4');
    expect(codeFor('RAD', '179*/167')).toBe('RAD-179*');
    expect(codeFor('OGN', null)).toBeNull();           // producto sellado: sin número
    expect(codeFor('RXK/DA', '001/010')).toBeNull();   // abreviatura que no es de un set
  });
  it('junta normal y foil, y gana el primer producto si dos comparten número', () => {
    const g = { groupId: 1, abbreviation: 'RAD', name: 'Radiance' };
    const products = [
      { productId: 10, name: 'Amateur Demolitionist', groupId: 1, extendedData: [{ name: 'Number', value: '001/167' }] },
      { productId: 11, name: 'Otra', groupId: 1, extendedData: [{ name: 'Number', value: '001/167' }] },
      { productId: 12, name: 'Booster Box', groupId: 1 },
    ];
    const prices = [
      { productId: 10, marketPrice: 0.25, lowPrice: 0.1, subTypeName: 'Normal' },
      { productId: 10, marketPrice: null, lowPrice: 1.5, subTypeName: 'Foil' },
      { productId: 11, marketPrice: 99, lowPrice: 99, subTypeName: 'Normal' },
      { productId: 12, marketPrice: 120, lowPrice: 110, subTypeName: 'Normal' },
    ];
    expect(pricesForGroup(g, products, prices)).toEqual({ 'RAD-001': [0.25, 0.1, 1.5, 1.5, 10] });
  });
});

describe('precios en la app', () => {
  const day = { 'RAD-001': [0.25, 0.1, 1.5, 1.2, 10], 'RAD-004': [2, 1.5, null, null, 11] } as any;
  it('precio por acabado; metal usa el de foil si no hay otro', () => {
    expect(priceOf(day, 'rad-001')).toBe(0.25);
    expect(priceOf(day, 'RAD-001', 'foil')).toBe(1.5);
    expect(priceOf(day, 'RAD-001', 'metal')).toBe(1.5);
    expect(priceOf(day, 'RAD-004', 'foil')).toBeNull();
    expect(priceOf(day, 'XXX-1')).toBeNull();
  });
  it('valor de la colección: copias por precio de su acabado', () => {
    const items = { 'RAD-001': { normal: 2, foil: 1 }, 'RAD-004': { normal: 1, foil: 1 } };
    expect(collectionValue(day, items)).toEqual({ value: 4, priced: 4, copies: 5 });
  });
  it('historial: puntos por día del acabado pedido', () => {
    const rows = [{ day: '2026-11-12', price: [0.2, 0.1, 1, 1, 10] }, { day: '2026-11-13', price: [null, null, 1.1, 1, 10] }, { day: '2026-11-14', price: [0.25, 0.1, 1.5, 1.2, 10] }];
    expect(historyPoints(rows as any, 'normal')).toEqual([{ day: '2026-11-12', v: 0.2 }, { day: '2026-11-14', v: 0.25 }]);
    expect(historyPoints(rows as any, 'foil').map(p => p.v)).toEqual([1, 1.1, 1.5]);
  });
});

describe('formato de precios', () => {
  it('cartas caras ($100 o más) sin centavos y sin error', () => {
    expect(money(0.09)).toBe('$0.09');
    expect(money(40.43)).toBe('$40.43');
    expect(money(149.99)).toBe('$150');
    expect(money(1234)).toBe('$1,234');
    expect(money(null)).toBe('—');
  });
});
