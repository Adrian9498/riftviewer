// Datos de cartas para las guías, sacados del catálogo de OpenRift (public/openrift-catalog.json) al compilar.
import type { GuideCardInfo } from './render';

interface Cat {
  cards: Record<string, { name: string; types?: string[]; superTypes?: string[]; domains?: string[]; tags?: string[] }>;
  printings: Record<string, {
    shortCode?: string; cardId: string; language?: string; artVariant?: string; isSigned?: boolean;
    isOvernumbered?: boolean; finish?: string; images?: { imageId: string }[];
  }>;
  tagCategoryMap?: Record<string, string>;
}

/** Nombre normalizado: sin mayúsculas ni diferencias de apóstrofo. */
export const cardKey = (s: string) => s.toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();

/** Por nombre: el código de la impresión normal en inglés (la que usa el constructor) y su imagen. */
export function guideCards(cat: Cat): Map<string, GuideCardInfo> {
  const out = new Map<string, GuideCardInfo & { s: number }>();
  for (const p of Object.values(cat.printings)) {
    if (p.language && p.language !== 'EN') continue;
    const img = p.images?.[0]?.imageId;
    const c = cat.cards[p.cardId];
    if (!img || !c || !p.shortCode) continue;
    const s = (p.artVariant === 'normal' ? 4 : 0) + (p.isSigned ? 0 : 2) + (p.isOvernumbered ? 0 : 1) + (p.finish === 'normal' ? 0.5 : 0);
    const k = cardKey(c.name);
    const prev = out.get(k);
    if (prev && prev.s >= s) continue;
    out.set(k, { name: c.name.replace(/’/g, "'"), code: p.shortCode.toUpperCase(), img: `https://openrift.app/media/cards/${img}-400w.webp`, type: (c.types || [])[0] || '', s });
  }
  return out;
}

/** Las leyendas del juego (para el índice de guías), una por campeón. */
export function legendNames(cat: Cat): { name: string; champ: string; domains: string[] }[] {
  const seen = new Map<string, { name: string; champ: string; domains: string[] }>();
  for (const c of Object.values(cat.cards)) {
    if (!(c.types || []).includes('legend')) continue;
    // el nombre del campeón es la etiqueta de tipo "legend" (las otras son región o especie)
    const champ = (c.tags || []).find(t => cat.tagCategoryMap?.[t] === 'legend') || (c.tags || [])[0] || c.name;
    if (!seen.has(champ)) seen.set(champ, { name: c.name.replace(/’/g, "'"), champ, domains: c.domains || [] });
  }
  return [...seen.values()].sort((a, b) => a.champ.localeCompare(b.champ));
}
