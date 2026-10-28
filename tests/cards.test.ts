import { describe, expect, it } from 'vitest';
import { norm } from '../src/data/text';
import { buildOpenRiftIndex, lookupByCode, type OpenRiftCatalog } from '../src/data/openrift';

describe('norm', () => {
  it('quita acentos, mayúsculas y signos', () => {
    expect(norm('Diana, Lunari')).toBe('diana lunari');
    expect(norm('Diana - Lunari')).toBe('diana lunari');
    expect(norm("An Offer You Can’t Refuse")).toBe('an offer you can t refuse');
    expect(norm('Campeón')).toBe('campeon');
    expect(norm(undefined)).toBe('');
  });
});

describe('OpenRift', () => {
  const p = (shortCode: string, cardId: string, extra: object = {}) =>
    ({ shortCode, cardId, language: 'EN', artVariant: 'normal', finish: 'normal', images: [{ imageId: 'img-' + shortCode }], ...extra });
  const cat: OpenRiftCatalog = {
    cards: { a: { name: 'Seraphine, Not Alone', types: ['unit'] }, b: { name: 'Starry-Eyed Songstress', types: ['legend'] }, c: { name: 'Packed Amphitheater', types: ['battlefield'] } },
    printings: {
      1: p('RAD-138', 'a', { printedRulesText: 'I have +1 :rb_might:.' }),
      2: p('RAD-138a', 'a', { artVariant: 'altart' }),
      3: p('RAD-174', 'b'),
      4: p('RAD-174*', 'b', { isSigned: true }),
      5: p('RAD-164', 'c'),
      6: p('RAD-164', 'c', { finish: 'foil' }),
      7: p('RAD-999', 'c', { images: [] }),             // sin imagen: se ignora
      8: p('RAD-500', 'c', { language: 'FR' }),          // otro idioma: se ignora
    },
  };
  const idx = buildOpenRiftIndex(cat, norm);

  it('indexa solo impresiones en inglés con imagen', () => {
    expect(idx.byCode.has('RAD-999')).toBe(false);
    expect(idx.byCode.has('RAD-500')).toBe(false);
  });

  it('empareja los códigos de RiftAtlas, incluidas las variantes', () => {
    expect(lookupByCode(idx, 'RAD-164')?.name).toBe('Packed Amphitheater');
    expect(lookupByCode(idx, 'rad-138A')?.img).toContain('img-RAD-138a');   // alternativa existente
    expect(lookupByCode(idx, 'RAD-174S')?.img).toContain('img-RAD-174*');   // "S" de RiftAtlas = "*" de OpenRift
    expect(lookupByCode(idx, 'RAD-138Z')?.img).toContain('img-RAD-138-');   // variante inexistente → carta base
    expect(lookupByCode(idx, null)).toBeNull();
  });

  it('prefiere la impresión normal y limpia los iconos del texto', () => {
    expect(idx.byName.get('seraphine not alone')?.img).toContain('img-RAD-138-');
    expect(idx.byCode.get('RAD-164')?.img).toBe('https://openrift.app/media/cards/img-RAD-164-400w.webp');
    expect(lookupByCode(idx, 'RAD-138')?.text).toBe('I have +1 ⚔.');
  });
});
