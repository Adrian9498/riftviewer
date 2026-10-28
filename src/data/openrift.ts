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
}

interface Printing {
  shortCode?: string;
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
interface Card { name?: string; slug?: string; types?: string[]; might?: number | null }
export interface OpenRiftCatalog { cards?: Record<string, Card>; printings?: Record<string, Printing> }

const ICON: Record<string, string> = { might: '⚔', energy: '⚡', power: '◆', exhaust: '⟳' };
const cleanText = (t?: string | null) => (t || '').replace(/:rb_([a-z_]+):/g, (_m, w: string) => ICON[w] || w);
const score = (p: Printing) =>
  (p.artVariant === 'normal' ? 4 : 0) + (p.isSigned ? 0 : 2) + (p.isOvernumbered ? 0 : 1) + (p.finish === 'normal' ? 0.5 : 0);

export const emptyIndex = (): OpenRiftIndex => ({ byCode: new Map(), byName: new Map() });

/** Indexa las impresiones en inglés con imagen, por código ("RAD-164") y por nombre normalizado. */
export function buildOpenRiftIndex(cat: OpenRiftCatalog, norm: (s: string) => string): OpenRiftIndex {
  const idx = emptyIndex();
  if (!cat?.printings) return idx;
  const cards = cat.cards || {};
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
  }
  return idx;
}

/**
 * Busca por código de RiftAtlas. Los replays usan "RAD-174S" (firmada) donde OpenRift usa "RAD-174*";
 * si la variante no existe, usa la carta base ("RAD-138A" → "RAD-138").
 */
export function lookupByCode(idx: OpenRiftIndex, code?: string | null): CardInfo | null {
  if (!code) return null;
  const c = code.toUpperCase();
  return idx.byCode.get(c) || idx.byCode.get(c.replace(/S$/, '*')) || idx.byCode.get(c.replace(/[A-Z*]+$/, '')) || null;
}
