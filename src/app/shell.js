// Generado a partir de legacy/app.js (sección "shell").
import { $, stage } from './base';
import { IDB, setStatus } from './cards';
import { applyProject, loadProj, renderClips } from './clips';
import { DEMO } from './demo';
import { fit } from './fit';
import { renderNotes } from './notes';
import { buildFrameList, loadReplay } from './replay';
import { camTo, rJump } from './replay-render';
import { STEPS, idx, jumpTo, run } from './script-engine';
import { app } from './state';
import { closeModal, esc, openModal } from './utils';

/* ================= Documento abierto, inicio, recientes y arrastrar archivos ================= */
export let DOC={kind:null,name:''};
export function setDoc(kind,name){
  DOC={kind,name}; $('#docname').innerHTML=kind?`${kind==='replay'?'▶ Replay':'✎ Guion'} · <b>${esc(name)}</b>`:'';
  $('#hClose').hidden=!kind; switchTab('jug');
  if(kind) maybeTour();
}
export function showHome(){ app.playing=false; renderRecents(); $('#home').classList.add('show'); }
export function hideHome(){ $('#home').classList.remove('show'); fit(); }
export function openReplay(json,name,raw){
  try{ loadReplay(json); }catch(err){ toast('No se pudo leer el replay: '+err.message,'err'); return false; }
  setDoc('replay',name); hideHome(); toast(`Replay abierto: ${name}`,'ok');
  saveRecent({id:app.R.key,kind:'replay',name,sub:app.R.players.map(p=>p.name).join(' vs '),data:raw||JSON.stringify(json)});
  return true;
}
export function openScript(text,name){
  app.playing=false; app.token++; app.R=null; document.body.classList.remove('replay');
  $('#victory').classList.remove('show'); $('#turninfo').textContent=''; document.querySelectorAll('.ov').forEach(o=>o.classList.remove('show'));
  $('#script').value=text; loadProj('rb_proj_script:'+name); setDoc('script',name); hideHome(); run(); renderClips();
  clearTimeout(saveT); saveRecent({id:'script:'+name,kind:'script',name,sub:`${STEPS.length} pasos`,data:text});
}
// guion nuevo: un esqueleto mínimo con instrucciones, en lugar del ejemplo completo
export const NEW_SCRIPT=`# 1) Pon los nombres, leyendas y campos de batalla:
jugador j1 "Jugador 1"
jugador j2 "Jugador 2"
# leyenda j1 "Nombre de la leyenda"
# campo A "Nombre del campo de batalla"
mano j1 4
mano j2 4

# 2) Escribe las jugadas (pulsa 📖 Comandos para ver todas):
turno j1
`;
export async function readDropped(file){
  const text=await file.text();
  if(/\.txt$/i.test(file.name)) return openScript(text,file.name.replace(/\.txt$/i,''));
  let j; try{ j=JSON.parse(text); }catch(e){ toast('El archivo no es un replay ni un guion válido','err'); return; }
  if(j.format==='riftatlas-replay') return openReplay(j,file.name.replace(/\.json$/i,'').replace(/^riftatlas-replay-/,'Replay '),text);
  if(j.format==='rb-vis-project'){ if(!DOC.kind){ toast('Abre primero la partida de este proyecto','err'); return; } return applyProject(j); }
  toast('No reconozco este archivo. Usa un replay de RiftAtlas (.json) o un guion (.txt).','err');
}
export let dragN=0;

// recientes (en IndexedDB): los últimos replays y guiones, para reabrirlos con un clic
export async function saveRecent(item){
  try{ item.ts=Date.now(); await IDB.set('recent:'+item.id,item);
    const old=(await IDB.entries()).filter(([k])=>k.startsWith('recent:')).sort((a,b)=>b[1].ts-a[1].ts).slice(8);
    for(const [k] of old) await IDB.del(k); }catch(e){}
}
export const ago=ts=>{ const m=Math.round((Date.now()-ts)/60000); return m<1?'ahora':m<60?`hace ${m} min`:m<1440?`hace ${Math.round(m/60)} h`:`hace ${Math.round(m/1440)} d`; };
export async function renderRecents(){
  let list=[]; try{ list=(await IDB.entries()).filter(([k])=>k.startsWith('recent:')).map(([,v])=>v).sort((a,b)=>b.ts-a.ts); }catch(e){}
  $('#hrecent').hidden=!list.length;
  $('#recents').innerHTML=list.map(r=>`<div class="rec-item" data-rid="${esc(r.id)}"><span class="ri">${r.kind==='replay'?'▶':'✎'}</span>
    <span class="rt"><b>${esc(r.name)}</b><small>${r.kind==='replay'?'Replay':'Guion'}${r.sub?' · '+esc(r.sub):''} · ${ago(r.ts)}</small></span>
    <button class="rx" data-rdel="${esc(r.id)}" title="Quitar de recientes">✕</button></div>`).join('');
}
// el guion se guarda solo en recientes mientras lo editas
export let saveT=null;
export function autosaveScript(){ if(DOC.kind!=='script') return; clearTimeout(saveT);
  saveT=setTimeout(()=>saveRecent({id:'script:'+DOC.name,kind:'script',name:DOC.name,sub:`${STEPS.length} pasos`,data:$('#script').value}),600); }

/* pestañas del panel (las mismas en guion y replay) */
export function switchTab(t){
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x.dataset.t===t));
  document.querySelectorAll('#editor .tab').forEach(x=>x.classList.toggle('on',x.dataset.t===t));
  if(t==='notas') renderNotes(); if(t==='clips') renderClips();
}

/* formato: siempre visible en la barra superior */
export function setFmt(f){
  stage.className=f; document.querySelectorAll('#fmtseg button').forEach(b=>b.classList.toggle('on',b.dataset.f===f));
  try{ localStorage.setItem('rb_fmt',f); }catch(e){} fit();
  if(app.R){ app.R.layoutKey=''; rJump(app.R.i); } else jumpTo(idx);
}

/* panel lateral plegable */
export function togglePanel(force){
  const off=force!==undefined?!force:!document.body.classList.contains('nopanel');
  document.body.classList.toggle('nopanel',off); $('#bPanel').classList.toggle('on',!off);
  if(off && !togglePanel.told && (togglePanel.told=true)) toast('Panel oculto: el tablero usa toda la ventana. Lleva el mouse arriba para ver la barra, o pulsa P. Con F11 queda a pantalla completa.');
  requestAnimationFrame(()=>{ fit(); if(app.R){ app.R.layoutKey=''; rJump(app.R.i); } });
}

/* ayuda: atajos de teclado, recorrido y restablecer opciones */
export const KEYS=[['Espacio','Reproducir / pausar'],['← →','Jugada anterior / siguiente'],['Inicio','Volver al principio'],['H','Modo grabación (oculta menús)'],['P','Mostrar u ocultar el panel'],
  ['?','Esta ayuda'],['Ctrl + Enter','Aplicar cambios del guion'],['Shift','Fijar la carta ampliada al pasar el mouse'],['Esc','Detener la grabación'],['Enter','Terminar de elegir cartas para una nota']];
export function openHelp(){
  const body=openModal('? Ayuda y atajos',`
    <div class="full keys">${KEYS.map(([k,d])=>`<span>${k.split(' ').map(x=>/^[+]$/.test(x)?'+':`<kbd>${x}</kbd>`).join(' ')}</span><span>${d}</span>`).join('')}</div>
    <div class="full hint" style="margin-top:6px">Clic derecho sobre una carta: poner o quitar su imagen · Arrastra un replay, guion o proyecto a la ventana para abrirlo.</div>
    <div class="full row" style="padding:6px 0 0"><button class="btn" id="hTour">Ver el recorrido de nuevo</button><button class="btn" id="hReset">Restablecer opciones</button></div>
    <div class="full hint">"Restablecer" vuelve a los valores de fábrica la marca, los sonidos, la vista y el formato. No borra tus recientes, imágenes de cartas, clips ni notas.</div>`,
    [['Cerrar','primary']]);
  body.querySelector('#hTour').onclick=()=>{ closeModal(); startTour(); };
  body.querySelector('#hReset').onclick=()=>{
    if(!confirm('¿Volver a las opciones de fábrica? Se recargará la página.')) return;
    try{ ['rb_brand','rb_snd','rb_lay','rb_lay2','rb_cam','rb_fmt','rb_tour'].forEach(k=>localStorage.removeItem(k)); }catch(e){}
    IDB.del('brand:logo').catch(()=>{}).then(()=>IDB.del('brand:bg')).catch(()=>{}).finally(()=>location.reload());
  };
}

/* recorrido de bienvenida: 3 pasos, solo la primera vez que se abre una partida */
export const TOUR=[
  {sel:'#topbar',t:'Barra superior',d:'Aquí eliges el <b>formato</b> (16:9 o 9:16), la velocidad, los sonidos 🔊 y tu marca 🎨. Con <b>⏺ Exportar</b> sacas el video con plantillas para YouTube, Shorts o clips.'},
  {sel:'#editor .tabs',t:'Panel lateral',d:'<b>Jugadas</b> o <b>Guion</b> para moverte por la partida, <b>Vista</b> para la distribución y la cámara, <b>⭐ Clips</b> para marcar momentos y <b>💬 Notas</b> para flechas, textos y "adivina la jugada".'},
  {sel:'#ctrl',t:'Reproducción',d:'Reproduce, pausa o avanza jugada por jugada. Atajos: <b>Espacio</b> y <b>← →</b>. Pulsa <b>?</b> cuando quieras ver todos los atajos.'}
];
export let TK=0;
export function startTour(){ togglePanel(true); TK=0; $('#tour').classList.add('show'); tourStep(); }
export function endTour(){ $('#tour').classList.remove('show'); try{ localStorage.setItem('rb_tour','1'); }catch(e){} }
export function tourStep(){
  const s=TOUR[TK], t=document.querySelector(s.sel); if(!t || !t.offsetParent){ if(++TK<TOUR.length) return tourStep(); return endTour(); }
  const r=t.getBoundingClientRect(), box=$('#tour .tbox'), bub=$('#tour .tbub'), pad=6;
  Object.assign(box.style,{left:(r.left-pad)+'px',top:(r.top-pad)+'px',width:(r.width+pad*2)+'px',height:(r.height+pad*2)+'px'});
  bub.querySelector('.tstep').textContent=`PASO ${TK+1} DE ${TOUR.length}`; bub.querySelector('h3').textContent=s.t; bub.querySelector('p').innerHTML=s.d;
  $('#tNext').textContent=TK===TOUR.length-1?'¡Listo!':'Siguiente';
  const bw=Math.min(340,innerWidth-24), below=r.bottom+16+200<innerHeight;
  const x=Math.max(12,Math.min(innerWidth-bw-12, r.left+r.width/2-bw/2));
  bub.style.left=x+'px'; bub.style.top=(below?r.bottom+16:Math.max(12,r.top-16-bub.offsetHeight))+'px';
}
export function maybeTour(){ let seen=false; try{ seen=!!localStorage.getItem('rb_tour'); }catch(e){} if(!seen) setTimeout(startTour,700); }

/* avisos flotantes */
export function toast(t,c){ setStatus(t,c); const d=document.createElement('div'); d.className='toast '+(c||''); d.textContent=t; $('#toasts').appendChild(d); setTimeout(()=>d.classList.add('out'),3200); setTimeout(()=>d.remove(),3700); }

export function init() {
  $('#replayIn').onchange=async e=>{ const f=e.target.files[0]; e.target.value=''; if(f) readDropped(f); };
  $('#fileIn').onchange=async e=>{ const f=e.target.files[0]; e.target.value=''; if(f) readDropped(f); };
  $('#hNew').onclick=()=>{ const d=new Date(); openScript(NEW_SCRIPT,`Guion ${d.toLocaleDateString('es',{day:'numeric',month:'short'})} ${d.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}`); };
  $('#hDemo').onclick=()=>openScript(DEMO,'Ejemplo');
  $('#hClose').onclick=hideHome;
  $('#bHome').onclick=showHome;
  addEventListener('dragenter',e=>{ if(e.dataTransfer?.types?.includes('Files')){ dragN++; $('#dropov').classList.add('show'); } });
  addEventListener('dragleave',()=>{ if(--dragN<=0){ dragN=0; $('#dropov').classList.remove('show'); } });
  addEventListener('dragover',e=>{ if(e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  addEventListener('drop',e=>{ dragN=0; $('#dropov').classList.remove('show');
    if(e.defaultPrevented) return;   // soltado sobre una carta: es una imagen para esa carta
    const f=e.dataTransfer?.files?.[0]; if(!f) return; e.preventDefault(); readDropped(f); });
  $('#recents').onclick=async e=>{
    const del=e.target.closest('[data-rdel]'); if(del){ await IDB.del('recent:'+del.dataset.rdel).catch(()=>{}); renderRecents(); return; }
    const it=e.target.closest('[data-rid]'); if(!it) return;
    const r=await IDB.get('recent:'+it.dataset.rid).catch(()=>null); if(!r) return;
    if(r.kind==='replay') openReplay(JSON.parse(r.data),r.name,r.data); else openScript(r.data,r.name);
  };
  document.querySelector('.tabs').onclick=e=>{ const b=e.target.closest('button'); if(b) switchTab(b.dataset.t); };
  $('#fmtseg').onclick=e=>{ const b=e.target.closest('button'); if(b) setFmt(b.dataset.f); };
  $('#bCmds').onclick=()=>{ openModal('📖 Comandos del guion',`<div class="full">${$('#cmdHelp').innerHTML}</div>`,[['Cerrar','primary']]); };
  $('#bPanel').onclick=()=>togglePanel();
  $('#bPanel').classList.add('on');
  $('#bHelp').onclick=openHelp;
  $('#tNext').onclick=()=>{ if(++TK<TOUR.length) tourStep(); else endTour(); };
  $('#tSkip').onclick=endTour;
  $('#rview').onchange=e=>{ app.R.view=e.target.value; app.R.layoutKey=''; rJump(app.R.i); };
  try{ $('#rlay').value=localStorage.getItem('rb_lay2')||'lanes'; $('#rcamsel').value=localStorage.getItem('rb_cam')||'suave'; }catch(e){}
  $('#rlay').onchange=e=>{ try{ localStorage.setItem('rb_lay2',e.target.value); }catch(err){} if(app.R){ app.R.layoutKey=''; rJump(app.R.i); } };
  $('#rcamsel').onchange=e=>{ try{ localStorage.setItem('rb_cam',e.target.value); }catch(err){} if(app.R) camTo(null,true); };
  $('#rhands').onchange=$('#rlang').onchange=()=>{ if($('#rlang').value) buildFrameList(); rJump(app.R.i); };
  $('#scrub').oninput=e=>{ if(app.R){ app.playing=false; rJump(+e.target.value); } };
}
