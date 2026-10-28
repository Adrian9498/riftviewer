// Barra de anotación sobre la mesa: marca clips y añade notas a la jugada actual sin ir al panel.
// Flecha y Resaltar piden elegir cartas en la mesa; luego una pequeña ventana pide el texto y los segundos.
import { $ } from './base';
import { PROJ, toggleMark } from './clips';
import { PB } from './export';
import { ADVANCED_NOTES, NOTEDRAFT, NOTE_SECS, PICK, addNote, cancelPick, startPick } from './notes';
import { needPremium } from './premium';
import { toast } from './shell';
import { esc } from './utils';

const TITLES = { texto: 'Texto en pantalla', flecha: 'Flecha', circulo: 'Resaltar cartas', pausa: 'Pausa para explicar', grafica: 'Gráfica de puntos', adivina: 'Adivina la jugada' };
const HELP = {
  texto: 'Aparece en grande sobre la mesa cuando la reproducción llega a esta jugada.',
  pausa: 'Congela la reproducción para que expliques con tu voz.',
  grafica: 'Muestra la evolución de los puntos de toda la partida.',
  adivina: 'Antes de esta jugada aparece "¿Qué harías tú?" con cuenta regresiva.',
};

/** pinta el estado del botón Clip según la jugada actual */
export function updAnnot() {
  const b = $('#annot [data-an="clip"]'); if (!b) return;
  const on = !!PROJ.marks[PB.cur()]; b.classList.toggle('on', on); b.title = on ? 'Quitar el clip de esta jugada' : 'Marcar esta jugada como clip';
}
function closePop() { $('#anpop').hidden = true; $('#anpop').innerHTML = ''; }
function openPop(html) { $('#anmore').hidden = true; const p = $('#anpop'); p.innerHTML = html; p.hidden = false; p.querySelector('input:not([type=number])')?.focus(); }

function form(type, picked) {
  const needsText = !['pausa', 'grafica'].includes(type);
  openPop(`<div class="aph"><b>${TITLES[type]}</b><small>en: ${esc(PB.label(PB.cur()).slice(0, 70))}</small></div>
    ${picked ? `<div class="appick">${esc(picked.join(' → '))}</div>` : ''}
    ${HELP[type] ? `<div class="aphint">${HELP[type]}</div>` : ''}
    <div class="apf">${needsText ? `<input type="text" id="apText" placeholder="${type === 'adivina' ? '¿Qué jugarías aquí?' : type === 'texto' ? 'Tu comentario' : 'Texto (opcional)'}">` : ''}
      <label title="Segundos en pantalla"><input type="number" id="apSecs" min="1" max="60" value="${NOTE_SECS(type)}"> s</label></div>
    <div class="apb"><button class="btn mini" data-ap="cancel">Cancelar</button><button class="btn mini primary" data-ap="add" data-type="${type}">Añadir nota</button></div>`);
}
function choose(type) {
  if (PB.cur() < 0) { toast('Avanza al menos una jugada para añadirle notas.'); return; }
  if (ADVANCED_NOTES.includes(type) && !needPremium('notes_advanced')) return;
  if (type === 'flecha' || type === 'circulo') {
    openPop(`<div class="aph"><b>${TITLES[type]}</b></div><div class="appick" id="anpick"></div><div class="apb"><button class="btn mini" data-ap="cancel">Cancelar</button></div>`);
    startPick(type === 'flecha' ? 2 : 99, () => form(type, NOTEDRAFT.names.slice()));
    return;
  }
  form(type);
}

export function init() {
  $('#annot').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const an = b.dataset.an, ap = b.dataset.ap;
    if (an === 'clip') { if (PB.cur() < 0) { toast('Avanza al menos una jugada para marcarla.'); return; } toggleMark(PB.cur()); updAnnot(); return; }
    if (an === 'more') { $('#anmore').hidden = !$('#anmore').hidden; return; }
    if (an) { if (PICK) cancelPick(); choose(an); return; }
    if (ap === 'cancel') { cancelPick(); closePop(); return; }
    if (ap === 'add') {
      const type = b.dataset.type, refs = ['flecha', 'circulo'].includes(type) ? NOTEDRAFT.refs : [];
      if (addNote(type, { text: $('#apText')?.value.trim() || '', secs: $('#apSecs').value, refs, names: NOTEDRAFT.names })) { closePop(); toast(`Nota añadida a la jugada`, 'ok'); }
    }
  });
  $('#annot').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.closest('#anpop input')) { e.preventDefault(); $('#anpop [data-ap="add"]')?.click(); }
    if (e.key === 'Escape') { cancelPick(); closePop(); }
  });
  // al cambiar de jugada, la ventana abierta ya no corresponde
  document.addEventListener('rb:pos', () => { updAnnot(); if (!PICK && !$('#anpop').hidden && !$('#anpop').contains(document.activeElement)) closePop(); });
  updAnnot();
}
