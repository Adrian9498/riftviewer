// Generado a partir de legacy/app.js (sección "clips").
import { noteLocalChange } from '../cloud/sync';
import { $ } from './base';
import { needPremium } from './premium';
import { setStatus } from './cards';
import { PB, playSegment, recordVideo } from './export';
import { renderNotes } from './notes';
import { buildFrameList, tr } from './replay';
import { DOC, toast } from './shell';
import { app } from './state';
import { esc } from './utils';

/* ================= 2. Marcadores y clips ================= */
export let PROJ={marks:{},notes:{},before:3,after:3}, PROJKEY='';
export function loadProj(key){ PROJKEY=key; PROJ={marks:{},notes:{},before:3,after:3}; try{ Object.assign(PROJ,JSON.parse(localStorage.getItem(key)||'{}')); }catch(e){} }
export function saveProj(){ PROJ.ts=Date.now(); try{ localStorage.setItem(PROJKEY,JSON.stringify(PROJ)); }catch(e){ setStatus('No se pudo guardar el proyecto en el navegador','err'); } noteLocalChange('projects'); }
export function frameText(i){ const f=app.R.frames[i]; return f.newLogs.length ? tr(f.newLogs[f.newLogs.length-1].text) : (f.actionType||'').replace(/_/g,' '); }
export function toggleMark(i){ if(i<0) return; if(PROJ.marks[i]) delete PROJ.marks[i]; else PROJ.marks[i]={label:PB.label(i).slice(0,60)}; saveProj(); if(app.R) buildFrameList(); renderClips(); }
export function clipSeg(i){ return {from:Math.max(app.R?0:-1,i-PROJ.before), to:Math.min(PB.count()-1,i+PROJ.after), label:PROJ.marks[i]?.label||''}; }
export const markIds = () => Object.keys(PROJ.marks).map(Number).sort((a,b)=>a-b);
export function renderClips(){
  if(!DOC.kind) return; const ids=markIds(), cur=PB.cur();
  $('#tclips').innerHTML=`<div class="tpad">
    <div class="hint">${app.R?'Pulsa ☆ en cualquier jugada de la pestaña <b>Jugadas</b>, o':'Avanza hasta la jugada que quieras (▶| o ◀) y'} usa el botón de abajo para convertirla en clip. Cada clip incluye unas jugadas antes y después, y su nombre aparece como título.</div>
    <div class="row" style="padding:8px 0"><button class="btn" id="cMarkCur" ${cur<0?'disabled':''}>☆ Marcar la jugada actual${cur>=0?` (#${cur})`:''}</button></div>
    <div class="form"><span>Jugadas antes</span><input type="number" id="cBefore" min="0" max="40" value="${PROJ.before}"><span>Jugadas después</span><input type="number" id="cAfter" min="0" max="40" value="${PROJ.after}"></div>
    <h4>${ids.length} clip${ids.length===1?'':'s'}</h4>
    ${ids.map(i=>`<div class="clip"><small>#${i} · T${PB.turn(i)}</small><input type="text" value="${esc(PROJ.marks[i].label)}" data-lbl="${i}"><button class="btn mini" data-cp="${i}" title="Ver clip">▶</button><button class="btn mini" data-cx="${i}" title="Exportar este clip">⏺</button><button class="btn mini" data-cd="${i}" title="Quitar">✕</button></div>`).join('') || '<div class="hint">Todavía no marcaste ninguna jugada.</div>'}
    ${ids.length?`<div class="row" style="padding:10px 0"><button class="btn" id="cPlayAll">▶ Ver todos</button><button class="btn primary lockable" id="cExpAll">⏺ Exportar todos en un video</button></div>`:''}
    <h4>Proyecto</h4><div class="hint">Clips y notas se guardan solos en este navegador. Para respaldarlos o pasarlos a otra PC:</div>
    <div class="row" style="padding:8px 0"><button class="btn" id="pSave">Guardar proyecto (.json)</button><button class="btn" id="pLoad">Abrir proyecto</button></div></div>`;
}
export function applyProject(j){
  if(j.replay!==PROJKEY && !confirm('Este proyecto es de otra partida. ¿Cargarlo de todos modos?')) return;
  PROJ=Object.assign({marks:{},notes:{},before:3,after:3},j.proj); saveProj(); if(app.R) buildFrameList(); renderClips(); renderNotes(); toast('Proyecto cargado','ok');
}

export function init() {
  // el nombre del clip también aparece en la línea de tiempo: se actualiza al terminar de escribir
  $('#tclips').addEventListener('change',e=>{ if((e.target.dataset.lbl || /^c(Before|After)$/.test(e.target.id)) && app.R) buildFrameList(); });
  $('#tclips').addEventListener('input',e=>{
    if(e.target.dataset.lbl){ PROJ.marks[e.target.dataset.lbl].label=e.target.value; saveProj(); }
    if(e.target.id==='cBefore') { PROJ.before=Math.max(0,+e.target.value||0); saveProj(); }
    if(e.target.id==='cAfter') { PROJ.after=Math.max(0,+e.target.value||0); saveProj(); }
  });
  $('#tclips').addEventListener('click',async e=>{
    const b=e.target.closest('button'); if(!b) return; const d=b.dataset;
    if(d.cp){ app.playing=false; await playSegment(clipSeg(+d.cp)); }
    else if(d.cx) recordVideo([clipSeg(+d.cx)]);
    else if(d.cd){ delete PROJ.marks[d.cd]; saveProj(); if(app.R) buildFrameList(); renderClips(); }
    else if(b.id==='cMarkCur'){ if(!PROJ.marks[PB.cur()]) toggleMark(PB.cur()); }
    else if(b.id==='cPlayAll'){ app.playing=false; for(const i of markIds()){ if(!await playSegment(clipSeg(i))) break; } }
    else if(b.id==='cExpAll'){ if(needPremium('export_presets')) recordVideo(markIds().map(clipSeg)); }
    else if(b.id==='pSave'){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify({format:'rb-vis-project',replay:PROJKEY,proj:PROJ},null,1)],{type:'application/json'})); a.download=`proyecto-${(DOC.name||'partida').replace(/[^\w-]+/g,'_')}.json`; a.click(); }
    else if(b.id==='pLoad') $('#projIn').click();
  });
  $('#projIn').onchange=async e=>{
    const f=e.target.files[0]; e.target.value=''; if(!f||!DOC.kind) return;
    try{ const j=JSON.parse(await f.text()); if(j.format!=='rb-vis-project') throw new Error('no es un proyecto'); applyProject(j); }
    catch(err){ toast('No se pudo abrir el proyecto: '+err.message,'err'); }
  };
}
