// Texto de reglas de las cartas con sus símbolos.
// riftcodex manda el texto con códigos como ":rb_might:", ":rb_energy_2:" o ":rb_rune_fury:",
// y una versión "rich" con párrafos y listas. Aquí se convierte a HTML seguro: solo se dejan
// pasar etiquetas de formato sin atributos y los códigos se cambian por iconos del set de index.html.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** riftcodex ya manda algunas entidades ("[Legion][&gt;]"): se pasan a su carácter para que esc() no las escape dos veces. */
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const unent = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
  return NAMED[e.toLowerCase()] ?? m;
});
/** texto de la carta a HTML seguro: primero sin entidades, después escapado una sola vez */
const safe = (s: string) => esc(unent(s));

export const DOMAINS: Record<string, string> = { fury: 'Furia', calm: 'Calma', mind: 'Mente', body: 'Cuerpo', chaos: 'Caos', order: 'Orden', rainbow: 'Cualquier dominio' };

/** HTML del icono para un código (sin los dos puntos), o null si no se conoce. */
export function symbolHTML(code: string): string | null {
  const svg = (id: string) => `<svg><use href="#s-${id}"/></svg>`;
  if (code === 'rb_might') return `<span class="sym sm-might" title="Poder">${svg('might')}</span>`;
  if (code === 'rb_exhaust') return `<span class="sym sm-exhaust" title="Agotar">${svg('exhaust')}</span>`;
  if (code === 'rb_power') return `<span class="sym sm-power" title="Poder de runa">${svg('power')}</span>`;
  if (code === 'rb_energy') return `<span class="sym sm-energy" title="Energía">${svg('energy')}</span>`;
  const e = /^rb_energy_(\d+)$/.exec(code);
  if (e) return `<span class="sym sm-num" title="${e[1]} de energía">${e[1]}</span>`;
  const r = /^rb_rune_([a-z]+)$/.exec(code);
  if (r && DOMAINS[r[1]]) return `<span class="sym sm-rune sm-${r[1]}" title="Runa: ${DOMAINS[r[1]]}">${svg('rune')}</span>`;
  return null;
}

const symbols = (s: string) => s.replace(/:(rb_[a-z0-9_]+):/g, (m, code: string) => symbolHTML(code) ?? esc(code.replace(/^rb_/, '').replace(/_/g, ' ')));

const ALLOWED = new Set(['p', 'ul', 'ol', 'li', 'br', 'b', 'i', 'em', 'strong']);

/** Convierte el texto de una carta (rich si lo hay, si no plain) a HTML seguro con símbolos. */
export function cardTextHTML(rich?: string | null, plain?: string | null): string {
  if (rich && rich.trim()) {
    const out = rich.split(/(<\/?[a-zA-Z]+\s*\/?>)/).map(part => {
      const t = /^<(\/?)([a-zA-Z]+)\s*\/?>$/.exec(part);
      if (t && ALLOWED.has(t[2].toLowerCase())) return `<${t[1]}${t[2].toLowerCase()}>`;
      return symbols(safe(part));
    });
    return out.join('');
  }
  return symbols(safe(plain || '')).replace(/\n/g, '<br>');
}
