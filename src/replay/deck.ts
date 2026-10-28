export interface DeckEntry {
  n: number;
  name: string;
  code?: string;
}

/**
 * Lee una lista de mazo en texto ("Legend:", "MainDeck:", "3 Stupefy [OGN-095]"…).
 * Devuelve las cartas agrupadas por sección, con el nombre de la sección sin espacios.
 */
export function parseDeck(raw: string): Record<string, DeckEntry[]> {
  const out: Record<string, DeckEntry[]> = {};
  let sec = 'Otros';
  raw.split(/\r?\n/).forEach(l => {
    const line = l.trim();
    if (!line) return;
    const h = line.match(/^([A-Za-z ]+):$/);
    if (h) {
      sec = h[1].replace(/\s/g, '');
      out[sec] = out[sec] || [];
      return;
    }
    const m = line.match(/^(\d+)\s+(.+?)\s*(?:\[([^\]]+)\])?$/);
    if (m) (out[sec] = out[sec] || []).push({ n: +m[1], name: m[2], code: m[3] });
  });
  return out;
}
