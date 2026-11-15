// Validación de un mazo según las reglas de construcción de Riftbound (Core Rules 103):
// 1 leyenda, campeón elegido con la etiqueta de la leyenda, 40+ cartas, hasta 3 copias por nombre,
// hasta 3 cartas de firma, 12 runas, 3 campos con nombres distintos y todo dentro de la identidad de dominio.
import { type CardLookup, type DCard, type Deck, mainWithChampion, total } from './model';

export interface Issue { level: 'error' | 'warn'; msg: string; codes?: string[] }

export const MAIN_MIN = 40, MAX_COPIES = 3, MAX_SIGNATURES = 3, RUNES = 12, BATTLEFIELDS = 3;

const sharesTag = (a: DCard, b: DCard) => a.tags.some(t => b.tags.includes(t));
/** ¿La carta cabe en la identidad de dominio? (sin dominio cabe en cualquiera) */
export const inIdentity = (c: DCard, identity: string[]) => c.dom.every(d => identity.includes(d));

export function validateDeck(d: Deck, get: CardLookup): Issue[] {
  const out: Issue[] = [];
  const legend = d.legend ? get(d.legend) : undefined;
  const identity = legend?.dom ?? [];

  if (!legend) out.push({ level: 'error', msg: 'Elige una leyenda.' });
  else if (legend.type !== 'Legend') out.push({ level: 'error', msg: `${legend.name} no es una leyenda.`, codes: [legend.code] });

  // campeón elegido
  const champ = d.champion ? get(d.champion) : undefined;
  if (!champ) out.push({ level: 'error', msg: 'Elige tu campeón (una unidad campeón de tu leyenda).' });
  else {
    if (champ.type !== 'Unit' || champ.sup !== 'Champion') out.push({ level: 'error', msg: `${champ.name} no es una unidad campeón.`, codes: [champ.code] });
    else if (legend && !sharesTag(champ, legend)) out.push({ level: 'error', msg: `${champ.name} no es el campeón de ${legend.name}.`, codes: [champ.code] });
  }

  // tamaño, copias, firmas y dominios del mazo principal
  const main = mainWithChampion(d), n = total(main);
  if (n < MAIN_MIN) out.push({ level: 'error', msg: `${MAIN_MIN - n === 1 ? 'Falta' : 'Faltan'} ${MAIN_MIN - n} carta${MAIN_MIN - n === 1 ? '' : 's'} en el mazo principal (mínimo ${MAIN_MIN}, contando al campeón).` });
  const byName = new Map<string, { n: number; codes: string[] }>();
  let sigs = 0; const badSig: string[] = [], offDomain: string[] = [], wrongType: string[] = [], unknown: string[] = [];
  for (const [code, k] of Object.entries(main)) {
    const c = get(code); if (!c) { unknown.push(code); continue; }
    const e = byName.get(c.name) || { n: 0, codes: [] }; e.n += k; e.codes.push(code); byName.set(c.name, e);
    if (c.sup === 'Signature') { sigs += k; if (legend && !sharesTag(c, legend)) badSig.push(code); }
    if (legend && !inIdentity(c, identity)) offDomain.push(code);
    if (['Legend', 'Rune', 'Battlefield'].includes(c.type) || c.sup === 'Token') wrongType.push(code);
  }
  for (const [name, e] of byName) if (e.n > MAX_COPIES) out.push({ level: 'error', msg: `Tienes ${e.n} copias de ${name} (máximo ${MAX_COPIES}).`, codes: e.codes });
  if (sigs > MAX_SIGNATURES) out.push({ level: 'error', msg: `Tienes ${sigs} cartas de firma (máximo ${MAX_SIGNATURES} en total).` });
  if (badSig.length) out.push({ level: 'error', msg: 'Hay cartas de firma de otro campeón.', codes: badSig });
  if (offDomain.length) out.push({ level: 'error', msg: 'Hay cartas fuera de los dominios de tu leyenda.', codes: offDomain });
  if (wrongType.length) out.push({ level: 'error', msg: 'Leyendas, runas, campos y fichas no van en el mazo principal.', codes: wrongType });
  if (unknown.length) out.push({ level: 'warn', msg: `No se reconocen ${unknown.length} carta${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}.`, codes: unknown });

  // runas
  const nr = total(d.runes);
  if (nr !== RUNES) out.push({ level: 'error', msg: nr < RUNES ? `${RUNES - nr === 1 ? 'Falta' : 'Faltan'} ${RUNES - nr} runa${RUNES - nr === 1 ? '' : 's'} (deben ser ${RUNES}).` : `${nr - RUNES === 1 ? 'Sobra' : 'Sobran'} ${nr - RUNES} runa${nr - RUNES === 1 ? '' : 's'} (deben ser ${RUNES}).` });
  const badRunes = Object.keys(d.runes).filter(code => { const c = get(code); return c && (c.type !== 'Rune' || (legend && !inIdentity(c, identity))); });
  if (badRunes.length) out.push({ level: 'error', msg: 'Hay runas fuera de los dominios de tu leyenda.', codes: badRunes });

  // campos de batalla
  const bfs = d.battlefields.map(get).filter((c): c is DCard => !!c);
  if (d.battlefields.length !== BATTLEFIELDS) out.push({ level: 'error', msg: `Elige ${BATTLEFIELDS} campos de batalla (tienes ${d.battlefields.length}).` });
  if (new Set(bfs.map(c => c.name)).size < bfs.length) out.push({ level: 'error', msg: 'Los campos de batalla deben tener nombres distintos.' });
  const badBf = bfs.filter(c => legend && !inIdentity(c, identity)).map(c => c.code);
  if (badBf.length) out.push({ level: 'error', msg: 'Hay campos fuera de los dominios de tu leyenda.', codes: badBf });

  return out;
}

export const isLegal = (d: Deck, get: CardLookup): boolean => !validateDeck(d, get).some(i => i.level === 'error');
