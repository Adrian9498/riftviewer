// Generado a partir de legacy/app.js (sección "notes").
import { isPremium } from '../cloud/plan';
import { $, stage } from './base';
import { needPremium } from './premium';
import { showChart } from './chart';
import { PROJ, saveProj } from './clips';
import { PB } from './export';
import { innerRect, scale } from './fit';
import { buildFrameList } from './replay';
import { frameElements } from './replay-render';
import { G, el } from './script-engine';
import { DOC } from './shell';
import { app } from './state';
import { esc, hold, sleep } from './utils';

/* ================= 3. Notas (anotaciones) y 8. Adivina la jugada ================= */
export let PICK=null;
export const NOTE_TYPES={texto:'💬 Texto',flecha:'➜ Flecha',circulo:'◯ Resaltar',pausa:'⏸ Pausa',grafica:'📈 Gráfica',adivina:'❓ Adivina'};
// notas de Full Access: sin el plan se conservan, pero no se muestran al reproducir ni al exportar
export const ADVANCED_NOTES=['flecha','circulo','adivina','grafica'];
const allowed = n => isPremium() || !ADVANCED_NOTES.includes(n.type);
export function refName(ref){
  if(ref.startsWith('f:')){ if(!app.R) return 'Campo '+ref.slice(2); const fd=app.R.fieldDefs?.find(x=>x.z===ref.slice(2)); return fd?.name||'campo'; }
  return app.R ? (app.R.el.get(ref)?._card?.name||'carta') : (G.cards[ref]?.name||'carta');
}
export function noteLabel(n){
  const t=(n.text?` "${esc(n.text)}"`:'')+(allowed(n)?'':' 🔒');
  if(n.type==='flecha') return `➜ ${esc(n.names?.[0])} → ${esc(n.names?.[1])}${t}`;
  if(n.type==='circulo') return `◯ ${esc((n.names||[]).join(', '))}${t}`;
  return `${NOTE_TYPES[n.type]}${t} · ${n.secs}s`;
}
export function renderNotes(){
  if(!DOC.kind) return; const i=PB.cur(), list=PROJ.notes[i]||[];
  if(i<0){ $('#tnotas').innerHTML=`<div class="tpad"><div class="hint">Avanza al menos una jugada con <b>▶|</b> para añadirle notas. Las notas aparecen cuando la reproducción llega a esa jugada.</div></div>`; return; }
  $('#tnotas').innerHTML=`<div class="tpad">
    <div class="hint">Las notas aparecen cuando la reproducción llega a esta jugada. Elige la jugada con ◀ ▶${app.R?' o desde la pestaña Jugadas':''}.</div>
    <h4>Jugada #${i}</h4><div class="hint">${esc(PB.label(i))}</div>
    ${list.map((n,k)=>`<div class="note"><span>${noteLabel(n)}</span><button class="btn mini" data-nd="${k}">✕</button></div>`).join('') || '<div class="hint" style="margin:6px 0">Sin notas en esta jugada.</div>'}
    <h4>Añadir nota</h4>
    <div class="form">
      <span>Tipo</span><select id="nType">${Object.entries({texto:'💬 Texto en pantalla',flecha:'➜ Flecha entre cartas',circulo:'◯ Resaltar cartas',pausa:'⏸ Pausa para explicar',grafica:'📈 Mostrar gráfica de puntos',adivina:'❓ Adivina la jugada (antes de la jugada)'}).filter(([v])=>app.R||v!=='grafica').map(([v,l])=>`<option value="${v}">${l}${!isPremium()&&ADVANCED_NOTES.includes(v)?' 🔒':''}</option>`).join('')}</select>
      <span class="nf-text">Texto</span><input type="text" id="nText" class="nf-text" placeholder="Ej: Aquí debió guardar Stupefy">
      <span>Segundos</span><input type="number" id="nSecs" min="1" max="60" value="4">
      <span class="nf-pick">Cartas</span><div class="nf-pick"><button class="btn mini" id="nPick">Elegir en la mesa</button> <small id="nPicked" style="color:var(--muted)"></small></div>
    </div>
    <div class="hint" id="nHelp" style="margin-top:8px"></div>
    <div class="row" style="padding:10px 0"><button class="btn primary" id="nAdd">Añadir nota</button><button class="btn" id="nTest">▶ Probar esta jugada</button></div></div>`;
  NOTEDRAFT={refs:[],names:[]}; updNoteForm();
}
export let NOTEDRAFT={refs:[],names:[]};
export const NOTE_HELP={
  texto:'Muestra tu comentario en grande sobre el tablero.',
  flecha:'Pulsa "Elegir en la mesa" y haz clic en la carta de origen y luego en la de destino (puede ser una carta o un campo de batalla). El texto es opcional.',
  circulo:'Pulsa "Elegir en la mesa" y haz clic en una o varias cartas; termina con Enter o con "Listo". El texto es opcional.',
  pausa:'Congela la reproducción unos segundos para que puedas explicar con tu voz.',
  grafica:'Muestra la gráfica de puntos de toda la partida durante unos segundos.',
  adivina:'Antes de mostrar esta jugada aparece "¿QUÉ HARÍAS TÚ?" con cuenta regresiva y luego se revela. Pon tu pregunta en el texto (opcional). Ideal para Shorts.'
};
export function updNoteForm(){
  const t=$('#nType')?.value; if(!t) return;
  document.querySelectorAll('.nf-pick').forEach(x=>x.style.display=['flecha','circulo'].includes(t)?'':'none');
  document.querySelectorAll('.nf-text').forEach(x=>x.style.display=['pausa','grafica'].includes(t)?'none':'');
  $('#nSecs').value = NOTE_SECS(t);
  $('#nHelp').textContent=NOTE_HELP[t];
  const np=$('#nPicked'); if(np) np.textContent=NOTEDRAFT.names.join(' → ');
}
// el estado de la elección se muestra en la pestaña Notas y en la barra de anotación sobre la mesa
const pickStatus = h => document.querySelectorAll('#nPicked,#anpick').forEach(x=>x.innerHTML=h);
const DONE='<button class="btn mini" data-pickdone>Listo</button>';
/** empieza a elegir cartas en la mesa; onDone se llama al terminar (no al cancelar) */
export function startPick(need,onDone){
  NOTEDRAFT={refs:[],names:[]}; PICK={need,onDone}; document.body.classList.add('picking');
  pickStatus(need===2?'Haz clic en la carta de <b>origen</b>…':'Haz clic en las cartas que quieres resaltar… '+DONE);
}
export function endPick(){ const cb=PICK?.onDone; PICK=null; document.body.classList.remove('picking'); updNoteForm(); cb?.(); }
export function cancelPick(){ if(!PICK) return; PICK.onDone=null; NOTEDRAFT={refs:[],names:[]}; endPick(); pickStatus(''); }
export const NOTE_SECS = t => ({adivina:5,grafica:6,pausa:3})[t]||4;
/** añade una nota a la jugada actual; devuelve false si falta algo (y ya avisó por qué) */
export function addNote(type,{text='',secs,refs=[],names=[]}={}){
  const ci=PB.cur(); if(ci<0){ alert('Avanza al menos una jugada para añadirle notas.'); return false; }
  if(ADVANCED_NOTES.includes(type) && !needPremium('notes_advanced')) return false;
  if(type==='texto' && !text){ alert('Escribe el texto.'); return false; }
  if(type==='flecha' && refs.length<2){ alert('Elige dos cartas (origen y destino) en la mesa.'); return false; }
  if(type==='circulo' && !refs.length){ alert('Elige al menos una carta en la mesa.'); return false; }
  const n={type,text,secs:Math.max(1,+secs||NOTE_SECS(type))};
  if(['flecha','circulo'].includes(type)){ n.refs=refs; n.names=names; }
  (PROJ.notes[ci]=PROJ.notes[ci]||[]).push(n); saveProj(); if(app.R) buildFrameList(); renderNotes();
  return true;
}

export function anchorEl(ref){
  if(!app.R) return ref.startsWith('f:') ? G.fields[ref.slice(2)] : el[ref];
  return ref.startsWith('f:') ? $(`#rfields .rfield[data-z="${ref.slice(2)}"]`) : app.R.el.get(ref);
}
export function relRect(el){ const r=el.getBoundingClientRect(), ir=innerRect(), sc=scale(); return {x:(r.left-ir.left)/sc,y:(r.top-ir.top)/sc,w:r.width/sc,h:r.height/sc}; }
export async function runNotes(i){
  const list=(PROJ.notes[i]||[]).filter(allowed); if(!list.length) return;
  const vis=list.filter(n=>['texto','flecha','circulo'].includes(n.type));
  if(vis.length){
    // antes de dibujar, la cámara encuadra todas las cartas/campos de las flechas y círculos
    const anchors=vis.flatMap(n=>(n.refs||[]).map(anchorEl)).filter(Boolean);
    if(anchors.length && app.R) await frameElements(anchors);
    const layer=document.createElement('div'); $('#fx').appendChild(layer);
    let svg='', secs=0; const texts=[];
    for(const n of vis){
      secs=Math.max(secs,n.secs||4); if(n.text) texts.push(n.text);
      if(n.type==='flecha'){ const a=anchorEl(n.refs[0]), b=anchorEl(n.refs[1]); if(!a||!b) continue;
        const ra=relRect(a), rb=relRect(b), x1=ra.x+ra.w/2, y1=ra.y+ra.h/2, x2=rb.x+rb.w/2, y2=rb.y+rb.h/2;
        const mx=(x1+x2)/2, my=(y1+y2)/2, dx=x2-x1, dy=y2-y1, cx=mx-dy*0.2, cy=my+dx*0.2;
        const tl=Math.hypot(x2-cx,y2-cy)||1, ux=(x2-cx)/tl, uy=(y2-cy)/tl, L=34, W=20;
        svg+=`<path pathLength="1" d="M${x1},${y1} Q${cx},${cy} ${x2-ux*L*0.6},${y2-uy*L*0.6}"/>`+
          `<polygon class="head" points="${x2},${y2} ${x2-ux*L-uy*W},${y2-uy*L+ux*W} ${x2-ux*L+uy*W},${y2-uy*L-ux*W}"/>`; }
      if(n.type==='circulo') for(const ref of n.refs){ const a=anchorEl(ref); if(!a) continue; const r=relRect(a);
        const d=document.createElement('div'); d.className='ringfx'; Object.assign(d.style,{left:(r.x-8)+'px',top:(r.y-8)+'px',width:(r.w+16)+'px',height:(r.h+16)+'px'}); layer.appendChild(d); }
    }
    if(svg) layer.insertAdjacentHTML('beforeend',`<svg class="arrowfx" viewBox="0 0 ${stage.offsetWidth} ${stage.offsetHeight}" width="${stage.offsetWidth}" height="${stage.offsetHeight}">${svg}</svg>`);
    const cp=$('#caption'); if(texts.length){ cp.innerHTML=texts.map(esc).join('<br>'); cp.classList.add('show'); }
    await hold(secs*1000);
    cp.classList.remove('show'); layer.remove();
  }
  for(const n of list){
    if(n.type==='pausa') await hold(n.secs*1000);
    if(n.type==='grafica' && app.R) await showChart(n.secs);
  }
}
export async function runQuiz(i){
  const n=(PROJ.notes[i]||[]).find(x=>x.type==='adivina'); if(!n || !allowed(n)) return;
  const q=$('#quiz'), c=q.querySelector('.count'); q.querySelector('.q').textContent=n.text||'Piensa la jugada antes de que se revele…';
  q.classList.add('show'); const my=app.token;
  for(let k=n.secs;k>0 && my===app.token;k--){ c.textContent=k; c.animate([{transform:'scale(1.4)',opacity:.4},{transform:'scale(1)',opacity:1}],{duration:400}); await hold(1000); }
  if(my===app.token){ c.textContent='¡VEAMOS!'; await hold(900); }
  q.classList.remove('show');
}

export function init() {
  $('#tnotas').addEventListener('change',e=>{ if(e.target.id==='nType'){ NOTEDRAFT={refs:[],names:[]}; updNoteForm(); } });
  $('#tnotas').addEventListener('click',async e=>{
    const b=e.target.closest('button'); if(!b) return;
    const ci=PB.cur();
    if(b.dataset.nd!==undefined){ PROJ.notes[ci].splice(+b.dataset.nd,1); if(!PROJ.notes[ci].length) delete PROJ.notes[ci]; saveProj(); if(app.R) buildFrameList(); renderNotes(); }
    else if(b.id==='nPick'){ if(needPremium('notes_advanced')) startPick($('#nType').value==='flecha'?2:99); }
    else if(b.id==='nAdd') addNote($('#nType').value,{text:$('#nText').value.trim(),secs:$('#nSecs').value,refs:NOTEDRAFT.refs,names:NOTEDRAFT.names});
    else if(b.id==='nTest'){ app.playing=false; await PB.jump(ci-1); await sleep(200); app.playing=true; PB.pos(); await PB.step(); app.playing=false; PB.pos(); }
  });
  stage.addEventListener('click',e=>{
    if(!PICK) return;
    const c=e.target.closest('.card'), f=e.target.closest('.rfield, .field');
    const ref = c&&c._cid ? c._cid : f ? 'f:'+(f.dataset.z||f.dataset.f) : null; if(!ref) return;
    e.stopPropagation(); NOTEDRAFT.refs.push(ref); NOTEDRAFT.names.push(refName(ref));
    if(NOTEDRAFT.refs.length>=PICK.need) endPick();
    else pickStatus(esc(NOTEDRAFT.names.join(' → '))+(PICK.need===2?' → haz clic en el <b>destino</b>…':' '+DONE));
  },true);
  document.addEventListener('keydown',e=>{ if(PICK && e.key==='Enter') endPick(); if(PICK && e.key==='Escape') cancelPick(); });
  document.addEventListener('click',e=>{ if(e.target.closest('[data-pickdone]')) endPick(); });
}
