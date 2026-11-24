// Mazo de Riftbound: leyenda, campeón elegido, mazo principal, runas, campos de batalla y banquillo.
// Las cartas se guardan por código ("OGN-095"), igual que en las listas del simulador.

import { t } from '../i18n/i18n';
export interface Deck {
  id: string;
  name: string;
  legend: string | null;
  champion: string | null;
  main: Record<string, number>;
  runes: Record<string, number>;
  battlefields: string[];
  side: Record<string, number>;
  updatedAt: number;
}

/** Lo que el constructor necesita saber de cada carta. */
export interface DCard {
  code: string;
  name: string;
  type: string;            // Unit, Spell, Gear, Legend, Rune, Battlefield
  sup: string | null;      // Champion, Signature, Token, Basic
  dom: string[];           // dominios; vacío = sin dominio (Colorless)
  tags: string[];          // normalizados; en leyendas y campeones, el nombre del campeón
  e: number | null;        // energía
  m: number | null;        // poder
  pw: number | null;       // poder de runa necesario
}
export type CardLookup = (code: string) => DCard | undefined;

export type Section = 'main' | 'runes' | 'side';

export const emptyDeck = (id: string, name = t('Mazo nuevo')): Deck =>
  ({ id, name, legend: null, champion: null, main: {}, runes: {}, battlefields: [], side: {}, updatedAt: Date.now() });

export const total = (r: Record<string, number>): number => Object.values(r).reduce((a, b) => a + b, 0);

/** Cartas del mazo principal contando al campeón elegido (que también cuenta para las 40). */
export function mainWithChampion(d: Deck): Record<string, number> {
  const out = { ...d.main };
  if (d.champion) out[d.champion] = (out[d.champion] || 0) + 1;
  return out;
}

/** ¿Dónde va una carta según su tipo? */
export function slotFor(c: DCard): 'legend' | 'battlefield' | 'runes' | 'main' | null {
  if (c.sup === 'Token') return null;
  if (c.type === 'Legend') return 'legend';
  if (c.type === 'Battlefield') return 'battlefield';
  if (c.type === 'Rune') return 'runes';
  return 'main';
}
