// Importar y exportar mazos: texto del simulador y enlaces para compartir.
import { parseDeck } from '../replay/deck';
import { type CardLookup, type Deck, emptyDeck } from './model';

/** Texto en el formato del simulador ("3 Stupefy [OGN-095]"), con sus secciones. */
export function toText(d: Deck, get: CardLookup): string {
  const line = (code: string, n: number) => `${n} ${get(code)?.name ?? code} [${code}]`;
  const block = (title: string, rows: [string, number][]) => rows.length ? `${title}:\n${rows.map(([c, n]) => line(c, n)).join('\n')}` : '';
  const sorted = (r: Record<string, number>) => Object.entries(r).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || (get(a[0])?.name ?? a[0]).localeCompare(get(b[0])?.name ?? b[0]));
  return [
    block('Legend', d.legend ? [[d.legend, 1]] : []),
    block('Champion', d.champion ? [[d.champion, 1]] : []),
    block('MainDeck', sorted(d.main)),
    block('Battlefields', d.battlefields.map(c => [c, 1] as [string, number])),
    block('Runes', sorted(d.runes)),
    block('Sideboard', sorted(d.side)),
  ].filter(Boolean).join('\n\n');
}

/** ¿La lista trae un mazo completo? (leyenda y al menos 40 cartas contando al campeón). Algunos replays solo traen parte. */
export function isCompleteList(raw: string): boolean {
  const secs = parseDeck(raw || ''), n = (k: string) => (secs[k] || []).reduce((a, e) => a + e.n, 0);
  return n('Legend') > 0 && ['Champion', 'MainDeck', 'Main', 'Deck', 'Otros'].reduce((a, k) => a + n(k), 0) >= 40;
}

/** Lee una lista del simulador (o una lista simple "3 Nombre [COD]"). resolve convierte nombre/código en código. */
export function fromText(raw: string, id: string, resolve: (name: string, code?: string) => string | null): { deck: Deck; missing: string[] } {
  const secs = parseDeck(raw), d = emptyDeck(id), missing: string[] = [];
  const add = (sec: string, fn: (code: string, n: number) => void) => (secs[sec] || []).forEach(e => {
    const code = resolve(e.name, e.code); if (code) fn(code, e.n); else missing.push(e.code ? `${e.name} [${e.code}]` : e.name);
  });
  add('Legend', c => { d.legend = c; });
  add('Champion', c => { d.champion = c; });
  for (const s of ['MainDeck', 'Main', 'Deck', 'Otros']) add(s, (c, n) => { d.main[c] = (d.main[c] || 0) + n; });
  add('Battlefields', (c, n) => { for (let k = 0; k < n; k++) d.battlefields.push(c); });
  add('Runes', (c, n) => { d.runes[c] = (d.runes[c] || 0) + n; });
  add('Sideboard', (c, n) => { d.side[c] = (d.side[c] || 0) + n; });
  return { deck: d, missing };
}

/* Enlace para compartir: el mazo va dentro del enlace (sin servidor ni cuenta).
   l=leyenda;c=campeón;m=COD*n,COD*n;r=…;b=COD,COD,COD;s=…;n=nombre — en base64url. */
const pack = (r: Record<string, number>) => Object.entries(r).filter(([, n]) => n > 0).map(([c, n]) => n > 1 ? `${c}*${n}` : c).join(',');
const unpack = (s: string) => Object.fromEntries((s ? s.split(',') : []).map(x => { const [c, n] = x.split('*'); return [c, +(n || 1)]; }));
const b64url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0)));

export function encodeDeck(d: Deck): string {
  return b64url([`l=${d.legend ?? ''}`, `c=${d.champion ?? ''}`, `m=${pack(d.main)}`, `r=${pack(d.runes)}`, `b=${d.battlefields.join(',')}`, `s=${pack(d.side)}`, `n=${d.name}`].join(';'));
}
export function decodeDeck(s: string, id: string): Deck | null {
  try {
    const f = Object.fromEntries(unb64url(s).split(';').map(p => { const k = p.indexOf('='); return [p.slice(0, k), p.slice(k + 1)]; }));
    const d = emptyDeck(id, f.n || 'Mazo compartido');
    d.legend = f.l || null; d.champion = f.c || null; d.main = unpack(f.m); d.runes = unpack(f.r);
    d.battlefields = f.b ? f.b.split(',') : []; d.side = unpack(f.s);
    return d;
  } catch { return null; }
}
