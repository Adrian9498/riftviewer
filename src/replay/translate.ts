// Traducción al español de las líneas del registro del simulador.

const RULES: [RegExp, string][] = [
  [/^(.+) played (.+) from hand to base\.$/, '$1 juega $2 en la base'],
  [/^(.+) played (.+) from hand to (.+)\.$/, '$1 juega $2 en $3'],
  [/^(.+) played (.+) token to base\.$/, '$1 crea un token de $2 en la base'],
  [/^(.+) played (.+) token to (.+)\.$/, '$1 crea un token de $2 en $3'],
  [/^Played (.+) from hand\.$/, 'Se juega $1 desde la mano'],
  [/^(.+) moved (.+) from (.+) to trash\.$/, '$1 manda $2 al descarte'],
  [/^(.+) moved (.+) to trash\.$/, '$1 manda $2 al descarte'],
  [/^(.+) moved (.+) to hand\.$/, '$1 regresa $2 a la mano'],
  [/^(.+) moved (.+) to base\.$/, '$1 mueve $2 a la base'],
  [/^(.+) moved (.+) to (.+)\.$/, '$1 mueve $2 a $3'],
  [/^(.+) conquered (.+) and scored (\d+)\.$/, '$1 conquista $2 y anota $3'],
  [/^(.+) conquered (.+)\.$/, '$1 conquista $2'],
  [/^(.+) scored (\d+) at turn start\. Score: (\d+) → (\d+)\.$/, '$1 anota $2 al inicio del turno ($3 → $4)'],
  [/^(.+) ended their turn\.$/, '$1 termina su turno'],
  [/^(.+) paid (.+?) — .*$/, '$1 paga $2'],
  [/^Chain resolved: (.+)\.$/, 'Se resuelve: $1'],
  [/^(.+) readied (\d+) (.+) runes?\.$/, '$1 prepara $2 runa(s) de $3'],
  [/^(.+) drew (\d+) cards?\.$/, '$1 roba $2'],
  [/^(.+) finalized mulligan \((\d+) recycled, (\d+) redrawn\)\.$/, '$1 hace mulligan de $2'],
  [/^Increased XP to (\d+)\. \(\+(\d+)\)$/, 'XP sube a $1'],
  [/^All mulligans are complete\. Starting the game\.$/, '¡Comienza la partida!'],
];

export type LogLang = 'es' | 'en';

/** Traduce una línea del registro; si no reconoce la frase la deja en inglés. */
export function translateLog(text: string, lang: LogLang | string = 'es'): string {
  if (lang !== 'es') return text;
  for (const [re, s] of RULES) if (re.test(text)) return text.replace(re, s);
  return text;
}
