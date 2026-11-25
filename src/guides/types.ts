// Guías de especialista: una por leyenda. El core sale de listas reales de torneo; el texto explica cómo
// encajan las cartas. Cada guía vive en src/guides/data/<leyenda>.ts y se dibuja al compilar (HTML estático,
// bueno para buscadores) en inglés y en español.

export type Lang = 'en' | 'es';
export type L10n = Record<Lang, string>;

/** Una carta en una tabla de la guía: en cuántas listas aparece y con cuántas copias. */
export interface GuideCard {
  name: string;
  /** en cuántas de las listas estudiadas aparece */
  lists: number;
  /** copias más comunes: "3", "1–2" */
  copies: string;
  /** para qué sirve (sobre todo en el banquillo) */
  why?: L10n;
}

/** Un bloque de texto. En los párrafos, [[Nombre de carta]] se vuelve una carta con vista previa. */
export interface GuideSection {
  id: string;
  h: string;
  p: string[];
  /** lista de puntos después de los párrafos */
  list?: string[];
  /** marca de "pendiente de revisión de un especialista" */
  draft?: boolean;
}

export interface GuideSource { date: string; event: string; place: string; players: number; player: string; meta: 'Radiance' | 'Vendetta' }

export interface Guide {
  slug: string;
  legend: string;
  champion: string;
  /** cómo se le dice en la página ("Diana") */
  short: string;
  domains: string[];
  updated: string;
  /** desde cuándo cuentan las listas (por ejemplo, el ban de Stacked Deck) */
  since: string;
  sinceWhy: L10n;
  /** cuántas listas se estudiaron, y de cuáles salen las tablas */
  studied: { total: number; main: number; mainMeta: string };
  title: L10n;
  description: L10n;
  intro: L10n;
  core: GuideCard[];
  flex: GuideCard[];
  side: GuideCard[];
  battlefields: GuideCard[];
  runes: L10n;
  sample: {
    label: L10n;
    source: string;
    main: Record<string, number>;
    battlefields: string[];
    runes: Record<string, number>;
    side: Record<string, number>;
  };
  sections: Record<Lang, GuideSection[]>;
  sources: GuideSource[];
  sourcesUrl: string;
}
