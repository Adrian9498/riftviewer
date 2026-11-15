// Catálogo de OpenRift (respaldo para cartas que riftcodex no tiene).
// Se descarga con `npm run catalogo` a public/openrift-catalog.json.

export interface CardInfo {
  name: string;
  img: string;
  text: string;
  type: string;
  slug?: string;
  /** poder base (solo unidades) */
  might: number | null;
  src: 'openrift';
  /** prioridad de la impresión: la normal, sin firma y sin numeración especial gana */
  _s: number;
}

export interface OpenRiftIndex {
  byCode: Map<string, CardInfo>;
  byName: Map<string, CardInfo>;
  /** tokens por nombre normalizado ("sand soldier"); img vacía si OpenRift no tiene su imagen */
  tokens: Map<string, CardInfo>;
}

interface Printing {
  shortCode?: string;
  rarity?: string;
  cardId: string;
  language?: string;
  artVariant?: string;
  isSigned?: boolean;
  isOvernumbered?: boolean;
  finish?: string;
  images?: { imageId: string }[];
  printedRulesText?: string | null;
  printedName?: string;
}
interface Card { name?: string; slug?: string; types?: string[]; superTypes?: string[]; might?: number | null; energy?: number | null; power?: number | null; domains?: string[]; tags?: string[] }
export interface OpenRiftCatalog { cards?: Record<string, Card>; printings?: Record<string, Printing> }

// los códigos de símbolos (:rb_might:…) se dejan tal cual: los dibuja cardTextHTML al mostrar el texto
const cleanText = (t?: string | null) => t || '';
const score = (p: Printing) =>
  (p.artVariant === 'normal' ? 4 : 0) + (p.isSigned ? 0 : 2) + (p.isOvernumbered ? 0 : 1) + (p.finish === 'normal' ? 0.5 : 0);

export const emptyIndex = (): OpenRiftIndex => ({ byCode: new Map(), byName: new Map(), tokens: new Map() });

/** Indexa las impresiones en inglés con imagen, por código ("RAD-164") y por nombre normalizado. */
export function buildOpenRiftIndex(cat: OpenRiftCatalog, norm: (s: string) => string): OpenRiftIndex {
  const idx = emptyIndex();
  if (!cat?.printings) return idx;
  const cards = cat.cards || {};
  const byCard = new Map<string, CardInfo>();
  for (const p of Object.values(cat.printings)) {
    if (p.language && p.language !== 'EN') continue;
    const imageId = p.images?.[0]?.imageId;
    if (!imageId) continue;
    const c = cards[p.cardId] || {};
    const e: CardInfo = {
      name: c.name || p.printedName || '',
      img: `https://openrift.app/media/cards/${imageId}-400w.webp`,
      text: cleanText(p.printedRulesText),
      type: (c.types || [])[0] || '',
      slug: c.slug,
      might: typeof c.might === 'number' ? c.might : null,
      src: 'openrift',
      _s: score(p),
    };
    const code = (p.shortCode || '').toUpperCase();
    if (code && (!idx.byCode.has(code) || idx.byCode.get(code)!._s < e._s)) idx.byCode.set(code, e);
    const nk = norm(e.name);
    if (nk && (!idx.byName.has(nk) || idx.byName.get(nk)!._s < e._s)) idx.byName.set(nk, e);
    if (!byCard.has(p.cardId) || byCard.get(p.cardId)!._s < e._s) byCard.set(p.cardId, e);
  }
  // tokens (Sprite, Recruit, Sand Soldier…): se registran aunque no tengan impresión con imagen;
  // si hay varios con el mismo nombre, gana el que sí tiene imagen
  for (const [id, c] of Object.entries(cards)) {
    if (!(c.superTypes || []).includes('token') || !c.name) continue;
    const k = norm(c.name);
    const e: CardInfo = byCard.get(id) || {
      name: c.name, img: '', text: '', type: (c.types || [])[0] || '', slug: c.slug,
      might: typeof c.might === 'number' ? c.might : null, src: 'openrift', _s: -1,
    };
    if (!idx.tokens.has(k) || (!idx.tokens.get(k)!.img && e.img)) idx.tokens.set(k, e);
  }
  return idx;
}

/**
 * Busca por código del simulador. Los replays usan "RAD-174S" (firmada) donde OpenRift usa "RAD-174*";
 * si la variante no existe, usa la carta base ("RAD-138A" → "RAD-138").
 */
export function lookupByCode(idx: OpenRiftIndex, code?: string | null): CardInfo | null {
  if (!code) return null;
  const c = code.toUpperCase();
  return idx.byCode.get(c) || idx.byCode.get(c.replace(/S$/, '*')) || idx.byCode.get(c.replace(/[A-Z*]+$/, '')) || null;
}

/** Carta con la misma forma que las de riftcodex (la que usan el visualizador y el constructor). */
export interface CatalogCard {
  name: string; n: string; type: string; sup: string | null; img: string; text: string; rich: string;
  e: number | null; m: number | null; pw: number | null; dom: string[]; rar: string; set: string;
  alt: boolean; tags: string[]; code: string; src: 'openrift';
}
const cap = (s?: string) => s ? s[0].toUpperCase() + s.slice(1) : '';

/**
 * Cartas de OpenRift que riftcodex todavía no tiene (por ejemplo, un set recién salido como Radiance).
 * have: códigos que ya vienen de riftcodex. Una entrada por código, con su mejor impresión en inglés.
 */
export function openRiftExtraCards(cat: OpenRiftCatalog, norm: (s: string) => string, have: Set<string>): CatalogCard[] {
  if (!cat?.printings) return [];
  const cards = cat.cards || {}, best = new Map<string, { p: Printing; s: number }>();
  for (const p of Object.values(cat.printings)) {
    if (p.language && p.language !== 'EN') continue;
    const code = (p.shortCode || '').toUpperCase(), c = cards[p.cardId];
    if (!code || !c || !p.images?.[0]?.imageId || have.has(code)) continue;
    const type = (c.types || [])[0];
    if (!type || type === 'other' || (c.superTypes || []).includes('token')) continue;
    const sc = score(p);
    if (!best.has(code) || best.get(code)!.s < sc) best.set(code, { p, s: sc });
  }
  return [...best.entries()].map(([code, { p }]) => {
    const c = cards[p.cardId], type = cap((c.types || [])[0]), sups = c.superTypes || [], tags = c.tags || [];
    let name = c.name || p.printedName || '';
    // OpenRift nombra las leyendas sin el campeón ("Boy Who Shattered Time"); riftcodex lo antepone ("Ekko - …")
    if (type === 'Legend' && tags[0] && !norm(name).startsWith(norm(tags[0]))) name = `${tags[0]} - ${name}`;
    const num = code.split('-')[1] || '';
    return {
      name, n: norm(name), type, sup: cap(sups.find(x => x !== 'token')) || null,
      img: `https://openrift.app/media/cards/${p.images![0].imageId}-400w.webp`,
      text: cleanText(p.printedRulesText), rich: '',
      e: c.energy ?? null, m: c.might ?? null, pw: c.power ?? null,
      dom: (c.domains || []).filter(d => d !== 'colorless').map(cap), rar: cap(p.rarity), set: code.split('-')[0],
      alt: p.artVariant !== 'normal' || !!p.isSigned || !!p.isOvernumbered || /[A-Z*]$/.test(num),
      tags: tags.map(norm), code, src: 'openrift' as const,
    };
  });
}
