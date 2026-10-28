// Barra de reproducción de un replay: marcas sobre la línea (turnos, conquistas, clips y notas)
// y la posición en palabras ("Turno 4 · 3/9") en lugar de "123 / 400".
import { actionKind } from '../replay/timeline';
import { $ } from './base';
import { PROJ, clipSeg } from './clips';
import { app } from './state';
import { esc } from './utils';

let SEC = [];   // por jugada: {label, k, n}
function sections() {
  const R = app.R; SEC = new Array(R.frames.length);
  let start = 0;
  const key = i => { const st = R.frames[i].state; return st.phase === 'in_game' ? 't' + st.turnNumber : (R.mull && i >= R.mull.start && i <= R.mull.end) ? 'mull' : 'prep'; };
  for (let i = 0; i <= R.frames.length; i++) {
    if (i < R.frames.length && i > start && key(i) === key(start)) continue;
    if (i > start || i === R.frames.length) {
      const k0 = key(start), label = k0 === 'mull' ? 'Mulligan' : k0 === 'prep' ? 'Preparación' : 'Turno ' + k0.slice(1);
      for (let j = start; j < i; j++) SEC[j] = { label, k: j - start + 1, n: i - start, first: start };
    }
    start = i;
  }
}
export function posLabel(i) {
  const s = SEC[i]; if (!s) return `${i} / ${app.R.frames.length - 1}`;
  return s.n > 1 ? `${s.label} · ${s.k}/${s.n}` : s.label;
}

const pct = i => (app.R.frames.length > 1 ? (i / (app.R.frames.length - 1)) * 100 : 0);
export function buildScrubMarks() {
  const box = $('#smarks'); if (!box) return;
  if (!app.R) { box.innerHTML = ''; return; }
  sections();
  const R = app.R; let h = '';
  // separación entre turnos
  SEC.forEach((s, i) => { if (s && s.first === i && i > 0 && s.label.startsWith('Turno')) h += `<i class="mk-turn" style="left:${pct(i)}%"></i>`; });
  // clips: franja dorada con las jugadas que incluye
  for (const k of Object.keys(PROJ.marks)) {
    const i = +k; if (i >= R.frames.length) continue; const s = clipSeg(i);
    h += `<b class="mk-clip" data-go="${i}" title="Clip: ${esc(PROJ.marks[i].label || '')}" style="left:${pct(s.from)}%;width:${Math.max(0.6, pct(s.to) - pct(s.from))}%"></b>`;
  }
  // conquistas y notas
  R.frames.forEach((f, i) => {
    const kind = actionKind(f.newLogs[f.newLogs.length - 1]?.actionType || f.actionType, f.newLogs.map(l => l.text).join(' ')).kind;
    if (kind === 'conquer') {
      const who = R.players.find(p => p.id === f.newLogs.find(l => /conquered/.test(l.text))?.authorPlayerId);
      h += `<b class="mk-conq" data-go="${i}" title="${esc(posLabel(i))}: conquista${who ? ' de ' + esc(who.name) : ''}" style="left:${pct(i)}%;--pc:${who?.col || 'var(--acc2)'}"><svg class="i"><use href="#i-flag"/></svg></b>`;
    }
    if ((PROJ.notes[i] || []).length) h += `<b class="mk-note" data-go="${i}" title="${esc(posLabel(i))}: ${PROJ.notes[i].length} nota${PROJ.notes[i].length > 1 ? 's' : ''}" style="left:${pct(i)}%"></b>`;
  });
  box.innerHTML = h;
}
