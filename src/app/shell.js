// Generado a partir de legacy/app.js (sección "shell").
import { noteLocalChange } from '../cloud/sync';
import { LANG, _t, locale } from '../i18n/i18n';
import { $, ic, stage, FMT_KEY, isPhone } from './base';
import { tombDoc, touchAsset } from './cloud-adapter';
import { IDB, cardByCode, setStatus } from './cards';
import { META_V, replayMeta } from '../replay/meta';
import { REPLAY_FILE_PREFIX, REPLAY_FORMAT } from '../replay/decode';
import { applyProject, loadProj, renderClips } from './clips';
import { DEMO, DEMO_EN } from './demo';
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
  DOC={kind,name}; $('#docname').innerHTML=kind?`${kind==='replay'?ic('replay')+' Replay':ic('pen')+' Guion'} · <b>${esc(name)}</b>`:'';
  $('#hClose').hidden=!kind; switchTab('jug');
  if(kind) maybeTour();
}
export function showHome(){ app.playing=false; renderRecents(); $('#home').classList.add('show'); }
export function hideHome(){ $('#home').classList.remove('show'); fit(); }
export function openReplay(json,name,raw){
  try{ loadReplay(json); }catch(err){ toast('No se pudo leer el replay: '+err.message,'err'); return false; }
  setDoc('replay',name); hideHome(); toast(`Replay abierto: ${name}`,'ok');
  let meta=null; try{ meta=replayMeta(json); }catch(e){}
  saveRecent({id:app.R.key,kind:'replay',name,sub:app.R.players.map(p=>p.name).join(' vs '),meta,data:raw||JSON.stringify(json)});
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
const NEW_SCRIPT_EN=`# 1) Set the names, legends and battlefields:
player p1 "Player 1"
player p2 "Player 2"
# legend p1 "Legend name"
# battlefield A "Battlefield name"
hand p1 4
hand p2 4

# 2) Write the plays (press 📖 Commands to see them all):
turn p1
`;
export async function readDropped(file){
  const text=await file.text();
  if(/\.txt$/i.test(file.name)) return openScript(text,file.name.replace(/\.txt$/i,''));
  let j; try{ j=JSON.parse(text); }catch(e){ toast('El archivo no es un replay ni un guion válido','err'); return; }
  if(j.format===REPLAY_FORMAT) return openReplay(j,file.name.replace(/\.json$/i,'').replace(REPLAY_FILE_PREFIX,'Replay '),text);
  if(j.format==='rb-vis-project'){ if(!DOC.kind){ toast('Abre primero la partida de este proyecto','err'); return; } return applyProject(j); }
  toast('No reconozco este archivo. Usa un replay del simulador (.json) o un guion (.txt).','err');
}
export let dragN=0;

// recientes (en IndexedDB): los últimos replays y guiones, para reabrirlos con un clic
export async function saveRecent(item){
  try{ item.ts=Date.now(); await IDB.set('recent:'+item.id,item);
    const old=(await IDB.entries()).filter(([k])=>k.startsWith('recent:')).sort((a,b)=>b[1].ts-a[1].ts).slice(8);
    for(const [k] of old) await IDB.del(k); }catch(e){}
  noteLocalChange('docs');
}
export const ago=ts=>{ const m=Math.round((Date.now()-ts)/60000); return m<1?'ahora':m<60?`hace ${m} min`:m<1440?`hace ${Math.round(m/60)} h`:`hace ${Math.round(m/1440)} d`; };
/* recientes: el último va como "Continuar donde te quedaste"; los demás, como tarjetas con las leyendas y el marcador */
const legImg = p => p?.legendCode||p?.legendName ? cardByCode(p.legendCode,p.legendName)?.img||'' : '';
function recArt(r){
  const ps=r.meta?.players||[];
  if(r.kind!=='replay') return `<div class="rart script">${ic('pen')}</div>`;
  if(!ps.length) return `<div class="rart">${ic('replay')}</div>`;
  return `<div class="rart legs">${ps.slice(0,2).map(p=>{ const u=legImg(p); return `<span${u?` style="background-image:url('${u}')"`:''}></span>`; }).join('')}</div>`;
}
function recScore(r){
  const ps=r.meta?.players||[]; if(r.kind!=='replay'||!ps.length) return '';
  return `<div class="rvs">${ps.map(p=>`<span class="${p.winner?'win':''}">${p.winner?ic('crown'):''}${esc(p.name)} <b>${p.score}</b></span>`).join('<i>vs</i>')}</div>`;
}
const recTitle = r => r.kind==='replay' && r.meta?.players?.length ? r.meta.players.map(p=>p.name).join(' vs ') : r.name;
const recSub = r => [r.kind==='replay'?'Replay':'Guion', r.meta?.turns?`${r.meta.turns} turnos`:(r.kind==='replay'?'':r.sub), ago(r.ts)].filter(Boolean).map(esc).join(' · ');
export async function renderRecents(){
  let list=[]; try{ list=(await IDB.entries()).filter(([k])=>k.startsWith('recent:')).map(([,v])=>v).sort((a,b)=>b.ts-a.ts); }catch(e){}
  const [first,...rest]=list;
  $('#hcont').hidden=!first; $('#hrecent').hidden=!rest.length;
  $('#hcont').innerHTML=first?`<div class="hcont-card" data-rid="${esc(first.id)}">${recArt(first)}
    <div class="hcont-txt"><small class="eyebrow">Continuar donde te quedaste</small><b>${esc(recTitle(first))}</b>${recScore(first)}<small>${recSub(first)}</small></div>
    <button class="btn primary">Continuar ${ic('arrow')}</button></div>`:'';
  $('#recents').innerHTML=rest.map(r=>`<div class="rtile" data-rid="${esc(r.id)}">${recArt(r)}
    <div class="rinfo"><b>${esc(recTitle(r))}</b>${recScore(r)}<small>${recSub(r)}</small></div>
    <button class="rx" data-rdel="${esc(r.id)}" title="Quitar de recientes">${ic('x')}</button></div>`).join('');
  backfillMeta(list);
}
// los recientes guardados antes (o bajados de la nube) no traen el resumen: se calcula una vez y se guarda
let filling=false;
async function backfillMeta(list){
  if(filling) return; const todo=list.filter(r=>r.kind==='replay'&&r.meta?.v!==META_V&&r.data); if(!todo.length) return;
  filling=true;
  try{ for(const r of todo){ try{ r.meta=replayMeta(JSON.parse(r.data))||{v:META_V,players:[],turns:null,finished:false}; await IDB.set('recent:'+r.id,r); }catch(e){} }
  }finally{ filling=false; }
  renderRecents();
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
  // en el teléfono el formato es de este dispositivo: no se sincroniza ni pisa al de la PC
  try{ localStorage.setItem(FMT_KEY(),f); }catch(e){} if(!isPhone()) noteLocalChange('settings'); fit();
  if(app.R){ app.R.layoutKey=''; rJump(app.R.i); } else jumpTo(idx);
}
/* estilo de la mesa: Fantasía (contenido) o Torneo (análisis de campeonato) */
export function setSkin(s){
  if(s!=='fan' && s!=='pro') s='fan';
  stage.dataset.skin=s; document.querySelectorAll('#skinseg button').forEach(b=>b.classList.toggle('on',b.dataset.s===s));
  try{ localStorage.setItem('rb_skin',s); }catch(e){} noteLocalChange('settings');
  if(app.R){ app.R.layoutKey=''; rJump(app.R.i); } else jumpTo(idx);
}

/* panel lateral plegable */
export function togglePanel(force){
  const off=force!==undefined?!force:!document.body.classList.contains('nopanel');
  document.body.classList.toggle('nopanel',off); $('#bPanel').classList.toggle('on',!off);
  // en el teléfono el panel es una hoja: abrirlo cierra Ajustes, y no hay "mouse arriba" que explicar
  if(!off && isPhone()){ document.body.classList.add('noinsp'); $('#bSettings').classList.remove('on'); }
  if(off && !isPhone() && !togglePanel.told && (togglePanel.told=true)) toast('Panel oculto: el tablero usa toda la ventana. Lleva el mouse arriba para ver la barra, o pulsa P. Con F11 queda a pantalla completa.');
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
    try{ ['rb_brand','rb_snd','rb_lay','rb_lay2','rb_cam','rb_fmt','rb_fmt_m','rb_skin','rb_tour'].forEach(k=>localStorage.removeItem(k));
      // marca el restablecimiento como el cambio más reciente, para que la nube no devuelva los ajustes viejos
      localStorage.setItem('rb_settings_ts',String(Date.now())); }catch(e){}
    touchAsset('brand:logo',true); touchAsset('brand:bg',true);
    IDB.del('brand:logo').catch(()=>{}).then(()=>IDB.del('brand:bg')).catch(()=>{}).finally(()=>location.reload());
  };
}

/* recorrido de bienvenida: 3 pasos, solo la primera vez que se abre una partida */
export const TOUR=[
  {sel:'#topbar [data-nav]',t:'Navegación',d:'Desde aquí vas a cualquier sección: <b>Inicio</b>, esta <b>Partida</b>, tus <b>Mazos</b> y tu <b>Colección</b>. El botón <b>atrás</b> del navegador también funciona.'},
  {sel:'#bSettings',t:'Ajustes',d:'Aquí está todo lo que cambia cómo se ve y suena la mesa: <b>estilo</b> (Fantasía o Torneo), <b>formato</b> 16:9 o 9:16, cámara, qué se ve, velocidad, sonidos y <b>tu marca</b>.'},
  {sel:'#bExport',t:'Exportar',d:'Saca el video con plantillas para YouTube, Shorts o clips.'},
  {sel:'#editor .tabs',t:'Panel lateral',d:'<b>Jugadas</b> o <b>Guion</b> para moverte por la partida, <b>Clips</b> para marcar momentos y <b>Notas</b> para flechas, textos y "adivina la jugada".'},
  {sel:'#ctrl',t:'Reproducción',d:'Reproduce, pausa o avanza jugada por jugada. Atajos: <b>Espacio</b> y <b>← →</b>. Pulsa <b>?</b> cuando quieras ver todos los atajos.'}
];
export let TK=0;
export function startTour(){ togglePanel(true); TK=0; $('#tour').classList.add('show'); tourStep(); }
export function endTour(){ $('#tour').classList.remove('show'); try{ localStorage.setItem('rb_tour','1'); }catch(e){} }
export function tourStep(){
  const s=TOUR[TK], t=document.querySelector(s.sel); if(!t || !t.offsetParent){ if(++TK<TOUR.length) return tourStep(); return endTour(); }
  const r=t.getBoundingClientRect(), box=$('#tour .tbox'), bub=$('#tour .tbub'), pad=6;
  Object.assign(box.style,{left:(r.left-pad)+'px',top:(r.top-pad)+'px',width:(r.width+pad*2)+'px',height:(r.height+pad*2)+'px'});
  bub.querySelector('.tstep').textContent=`PASO ${TK+1} DE ${TOUR.length}`; bub.querySelector('h3').textContent=s.t; bub.querySelector('p').innerHTML=_t(s.d);
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
  $('#hNew').onclick=()=>{ const d=new Date(); openScript(LANG==='en'?NEW_SCRIPT_EN:NEW_SCRIPT,`${_t('Guion')} ${d.toLocaleDateString(locale(),{day:'numeric',month:'short'})} ${d.toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'})}`); };
  $('#hDemo').onclick=()=>openScript(LANG==='en'?DEMO_EN:DEMO,_t('Ejemplo'));
  $('#hClose').onclick=hideHome;
  // las imágenes de las leyendas llegan cuando terminan de cargar las cartas
  document.addEventListener('rb:cards',()=>{ if($('#home').classList.contains('show')) renderRecents(); });
  addEventListener('dragenter',e=>{ if(e.dataTransfer?.types?.includes('Files')){ dragN++; $('#dropov').classList.add('show'); } });
  addEventListener('dragleave',()=>{ if(--dragN<=0){ dragN=0; $('#dropov').classList.remove('show'); } });
  addEventListener('dragover',e=>{ if(e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  addEventListener('drop',e=>{ dragN=0; $('#dropov').classList.remove('show');
    if(e.defaultPrevented) return;   // soltado sobre una carta: es una imagen para esa carta
    const f=e.dataTransfer?.files?.[0]; if(!f) return; e.preventDefault(); readDropped(f); });
  $('#recents').onclick=$('#hcont').onclick=async e=>{
    const del=e.target.closest('[data-rdel]'); if(del){ await IDB.del('recent:'+del.dataset.rdel).catch(()=>{}); tombDoc(del.dataset.rdel); renderRecents(); return; }
    const it=e.target.closest('[data-rid]'); if(!it) return;
    const r=await IDB.get('recent:'+it.dataset.rid).catch(()=>null); if(!r) return;
    if(r.kind==='replay') openReplay(JSON.parse(r.data),r.name,r.data); else openScript(r.data,r.name);
  };
  document.querySelector('.tabs').onclick=e=>{ const b=e.target.closest('button'); if(b) switchTab(b.dataset.t); };
  $('#fmtseg').onclick=e=>{ const b=e.target.closest('button'); if(b) setFmt(b.dataset.f); };
  $('#skinseg').onclick=e=>{ const b=e.target.closest('button'); if(b) setSkin(b.dataset.s); };
  $('#bCmds').onclick=()=>{ openModal('Comandos del guion',`<div class="full">${$(LANG==='en'?'#cmdHelpEn':'#cmdHelp').innerHTML}</div>`,[['Cerrar','primary']]); };
  $('#bPanel').onclick=()=>togglePanel();
  $('#bPanelX').onclick=()=>togglePanel(false);
  // en el teléfono la mesa arranca a pantalla completa y el panel se abre como hoja desde abajo
  if(isPhone()) document.body.classList.add('nopanel'); else $('#bPanel').classList.add('on');
  $('#bHelp').onclick=openHelp;
  $('#tNext').onclick=()=>{ if(++TK<TOUR.length) tourStep(); else endTour(); };
  $('#tSkip').onclick=endTour;
  $('#rview').onchange=e=>{ app.R.view=e.target.value; app.R.layoutKey=''; rJump(app.R.i); };
  try{ $('#rlay').value=localStorage.getItem('rb_lay2')||'lanes'; $('#rcamsel').value=localStorage.getItem('rb_cam')||'suave'; }catch(e){}
  $('#rlay').onchange=e=>{ try{ localStorage.setItem('rb_lay2',e.target.value); }catch(err){} noteLocalChange('settings'); if(app.R){ app.R.layoutKey=''; rJump(app.R.i); } };
  try{ const v=localStorage.getItem('rb_arrow'); if(v) $('#rarrow').value=v; }catch(e){}
  $('#rarrow').onchange=e=>{ try{ localStorage.setItem('rb_arrow',e.target.value); }catch(err){} };
  $('#rcamsel').onchange=e=>{ try{ localStorage.setItem('rb_cam',e.target.value); }catch(err){} noteLocalChange('settings'); if(app.R) camTo(null,true); };
  $('#rhands').onchange=$('#rlang').onchange=()=>{ if($('#rlang').value) buildFrameList(); rJump(app.R.i); };
  $('#scrub').oninput=e=>{ if(app.R){ app.playing=false; rJump(+e.target.value); } };
  $('#smarks').onclick=e=>{ const m=e.target.closest('[data-go]'); if(m&&app.R){ app.playing=false; rJump(+m.dataset.go); } };
}
