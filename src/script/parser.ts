// Lectura del lenguaje de guiones: una jugada por línea, nombres de cartas entre comillas.

export type Player = 1 | 2;

export interface Step {
  cmd: string;
  /** línea del guion (empieza en 1) */
  line: number;
  pl?: Player;
  /** primer número de la línea, tal como se escribió (puede llevar + o -) */
  num?: string;
  /** primer texto entre comillas */
  q?: string;
  /** palabra después de "a" (destino): "base", "A", "B"… */
  dest: string | null;
  field?: string;
  words: string[];
}

export interface ParseResult {
  steps: Step[];
  errors: string[];
}

type Token = { q: string } | { w: string };

export const COMMANDS = [
  'jugador', 'leyenda', 'campeon', 'campo', 'mano', 'meta', 'turno', 'fase', 'roba', 'runas', 'juega', 'mueve',
  'agota', 'prepara', 'dano', 'cura', 'poder', 'combate', 'conquista', 'controla', 'libera', 'muere', 'regresa',
  'puntos', 'foco', 'texto', 'pausa', 'gana', 'pon',
] as const;

/** comandos de configuración: se aplican siempre, aunque se salte a una jugada posterior */
export const SETUP_COMMANDS = ['jugador', 'leyenda', 'campeon', 'campo', 'mano', 'meta', 'pon'];
export const isSetup = (s: Pick<Step, 'cmd'>): boolean => SETUP_COMMANDS.includes(s.cmd);

const NEEDS_PLAYER = ['pon', 'jugador', 'leyenda', 'campeon', 'mano', 'turno', 'roba', 'runas', 'juega', 'mueve', 'conquista', 'controla', 'puntos', 'gana'];
const NEEDS_QUOTED = ['pon', 'leyenda', 'campeon', 'juega', 'mueve', 'agota', 'dano', 'cura', 'poder', 'muere', 'regresa', 'foco', 'texto', 'fase'];
const NEEDS_FIELD = ['combate', 'conquista', 'controla', 'libera'];
const NEEDS_NUMBER = ['dano', 'poder', 'meta', 'mano', 'runas', 'puntos'];

/** Los comandos también se pueden escribir en inglés: "play p1 "Card" to base" = "juega j1 "Carta" a base". */
export const EN_COMMANDS: Record<string, (typeof COMMANDS)[number]> = {
  player: 'jugador', legend: 'leyenda', champion: 'campeon', battlefield: 'campo', field: 'campo', hand: 'mano',
  goal: 'meta', turn: 'turno', phase: 'fase', draw: 'roba', runes: 'runas', play: 'juega', move: 'mueve',
  exhaust: 'agota', ready: 'prepara', damage: 'dano', heal: 'cura', might: 'poder', combat: 'combate', fight: 'combate',
  conquer: 'conquista', hold: 'controla', control: 'controla', release: 'libera', die: 'muere', dies: 'muere', kill: 'muere',
  return: 'regresa', points: 'puntos', score: 'puntos', focus: 'foco', text: 'texto', pause: 'pausa', wait: 'pausa',
  win: 'gana', wins: 'gana', put: 'pon', place: 'pon',
};
// "pon" acomoda la mesa al empezar: pon j1 "Carta" en A [oculta] [agotada]; también en base, descarte o mano.
// "juega … desde descarte [recicla]": un hechizo que se juega desde el descarte (Fizz) y luego se recicla.
const EN_WORDS: Record<string, string> = {
  to: 'a', all: 'todo', at: 'en', hidden: 'oculta', exhausted: 'agotada', trash: 'descarte', hand: 'mano', from: 'desde', recycle: 'recicla',
};

export const playerOf = (w: string | undefined): Player | undefined =>
  ({ j1: 1, j2: 2, p1: 1, p2: 2 } as Record<string, Player>)[w?.toLowerCase() ?? ''];

export function tokenize(line: string): Token[] {
  const out: Token[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push(m[1] !== undefined ? { q: m[1] } : { w: m[2] });
  return out;
}

const stripAccents = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function parse(src: string): ParseResult {
  const steps: Step[] = [];
  const errors: string[] = [];
  src.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) return;
    const t = tokenize(line);
    const first = 'w' in t[0] ? t[0].w : '';
    const cmd0 = stripAccents(first);
    const cmd = EN_COMMANDS[cmd0] ?? cmd0;
    const rest = t.slice(1);
    const words = rest.flatMap(x => ('w' in x ? [EN_WORDS[x.w.toLowerCase()] ?? x.w] : []));
    const quoted = rest.flatMap(x => ('q' in x ? [x.q] : []));
    const pl = words.map(playerOf).find(Boolean);
    const num = words.find(w => /^[+-]?\d+(\.\d+)?$/.test(w));
    const aIdx = words.findIndex(w => w.toLowerCase() === 'a');
    // destino: la palabra después de "a" (o de "en" para pon)
    const enIdx = cmd === 'pon' ? words.findIndex(w => w.toLowerCase() === 'en') : -1;
    const dest = enIdx >= 0 ? (words[enIdx + 1] ?? null) : aIdx >= 0 ? (words[aIdx + 1] ?? null) : null;
    const fieldW = words.find(w => (/^[abc]$/i.test(w) && w.toLowerCase() !== 'a') || /^[ABC]$/.test(w));
    const s: Step = { cmd, line: i + 1, pl, num, q: quoted[0], dest, field: fieldW?.toUpperCase(), words };
    const need = (cond: unknown, msg: string) => {
      if (!cond) errors.push(`Línea ${i + 1}: ${msg}`);
      return !!cond;
    };
    if (!need((COMMANDS as readonly string[]).includes(cmd), `comando desconocido "${first}"`)) return;
    if (NEEDS_PLAYER.includes(cmd)) need(pl, 'falta el jugador (j1 o j2)');
    if (NEEDS_QUOTED.includes(cmd)) need(quoted.length, 'falta el nombre entre comillas');
    if (cmd === 'prepara' && !quoted[0]) need(words.some(w => w.toLowerCase() === 'todo'), 'usa "prepara \\"Carta\\"" o "prepara j1 todo"');
    if (cmd === 'campo') {
      const f = words[0]?.toUpperCase();
      s.field = f;
      need(/^[ABC]$/.test(f || ''), 'campo debe ser A, B o C');
      need(quoted[0], 'falta el nombre del campo');
    }
    if (NEEDS_FIELD.includes(cmd)) {
      const f = words.find(w => /^[abc]$/i.test(w) && !playerOf(w));
      s.field = f?.toUpperCase();
      need(s.field, 'falta el campo (A, B o C)');
    }
    if (cmd === 'mueve') need(dest, 'falta el destino: a base / a A');
    if (cmd === 'pon') need(dest && /^(base|[abc]|descarte|mano)$/i.test(dest), 'falta dónde: en base / en A / en descarte / en mano');
    if (NEEDS_NUMBER.includes(cmd)) need(num !== undefined, 'falta un número');
    steps.push(s);
  });
  return { steps, errors };
}
