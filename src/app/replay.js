// Generado a partir de legacy/app.js (sección "replay").
import { decodeReplay } from '../replay/decode';
import { isCompleteList } from '../deck/format';
import { computeMulligans } from '../replay/mulligan';
import { translateLog } from '../replay/translate';
import { LANG } from '../i18n/i18n';
import { KIND_ICON, actionKind } from '../replay/timeline';
import { $, ic, stage } from './base';
import { analyze } from './chart';
import { PROJ, loadProj, toggleMark } from './clips';
import { R_addField, buildLanes } from './layout-lanes';
import { buildMinimap, offIn, rJump, rPos, rRender } from './replay-render';
import { noteLabel } from './notes';
import { app } from './state';
import { esc } from './utils';
import { switchTab } from './shell';
import { buildScrubMarks } from './transport';

/* ================= Replays del simulador ================= */


export const BFZ=['battlefieldA','battlefieldB','battlefieldC','battlefieldToken'];
export const arr = x => !x ? [] : Array.isArray(x) ? x.filter(c=>c&&c.id) : (x.id ? [x] : []);


/** lista del mazo de un jugador tal como la guarda el simulador */
export const deckRawOf = p => p ? (p.deck?.raw||p.decklistRaw||p.submittedDeck?.raw||p.registeredDeck?.raw||'') : '';
// en inglés el registro se queda como lo escribe el simulador
export const tr = t => translateLog(t, LANG === 'en' ? 'en' : $('#rlang').value);

export function loadReplay(json){
  const rp=decodeReplay(json);
  const frames=(rp.frames||[]).filter(f=>f&&f.state&&f.state.players);
  if(!frames.length) throw new Error('El replay no tiene jugadas');
  const last=frames[frames.length-1].state;
  const players=[...last.players].sort((a,b)=>a.seat-b.seat).map((p,i)=>({id:p.id,name:p.name,col:app.PCOL[i%4],bfCode:p.selectedBattlefieldCardCode,bfName:p.selectedBattlefield}));
  // registro nuevo de cada frame
  let seen=new Set();
  frames.forEach(f=>{
    const logs=(f.state.log||[]).filter(l=>l&&l.id&&!seen.has(l.id)).sort((a,b)=>a.at-b.at);
    seen=new Set((f.state.log||[]).map(l=>l.id));
    f.newLogs=logs;
  });
  const start=Math.max(0,frames.findIndex(f=>f.state.phase==='in_game'));
  app.R={rp,frames,players,start,i:-1,shown:null,ctrl:{},layoutKey:'',
     view:players.some(p=>p.id===rp.viewerPlayerId)?rp.viewerPlayerId:players[0].id};
  app.R.render=rRender;
  app.R.mull=computeMulligans(frames);
  app.R.key='rb_proj_'+(rp.replayId||(last.roomCode+':'+last.createdAt));
  loadProj(app.R.key); analyze();
  document.body.classList.add('replay');
  $('#rview').innerHTML=players.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  $('#rview').value=app.R.view;
  // con la lista de cada jugador se puede abrir su mazo en el constructor (solo si está completa)
  const withDeck=players.filter(p=>isCompleteList(deckRawOf(last.players.find(x=>x.id===p.id))));
  $('#pinfo').innerHTML=`${players.map(p=>`<b style="color:${p.col}">${esc(p.name)}</b>`).join(' vs ')}<br>${last.turnNumber||'?'} turnos · ${frames.length} jugadas`
    +(withDeck.length?`<div class="pdecks">${withDeck.map(p=>`<button class="btn mini" data-deckof="${esc(p.id)}" title="Abrir su lista en el constructor de mazos">${ic('cards')} Mazo de ${esc(p.name)}</button>`).join('')}</div>`:'');
  buildFrameList();
  app.playing=false; app.token++;
  $('#scrub').max=frames.length-1;
  rJump(startFrame());
}
/** Jugada en la que empieza la reproducción, según "Empezar en" (mulligan, partida o desde el principio). */
export function startFrame(){
  const v=$('#rskip').value, R=app.R;
  return v==='mull' ? (R.mull?.start ?? R.start) : v==='1' ? R.start : 0;
}

/* Línea de tiempo: jugadas agrupadas por turno, con icono por tipo, color del jugador y,
   debajo de cada jugada, su clip y sus notas. "Solo lo importante" oculta pagos, robos, etc. */
export const TL={minorHidden:false, collapsed:new Set()};
try{ TL.minorHidden=localStorage.getItem('rb_tlmin')==='1'; }catch(e){}
const sym = id => `<svg class="i"><use href="#${id}"/></svg>`;
function sectionOf(f,i){
  const R=app.R, st=f.state;
  if(st.phase==='in_game') return {key:'t'+st.turnNumber, turn:st.turnNumber, pid:st.activeTurnPlayerId};
  if(R.mull && i>=R.mull.start && i<=R.mull.end) return {key:'mull', label:'Mulligan'};
  return {key:'prep', label:'Preparación'};
}
const scoreLine = st => app.R.players.map(p=>{ const b=st.players.find(x=>x.id===p.id)?.board; return `<b style="color:${p.col}">${b?.score||0}</b>`; }).join('<i>–</i>');
export function buildFrameList(){
  const R=app.R, box=$('#frames'), secs=[];
  R.frames.forEach((f,i)=>{ const s=sectionOf(f,i); if(!secs.length || secs[secs.length-1].key!==s.key) secs.push({...s,from:i,items:[]}); secs[secs.length-1].items.push(i); });
  let html=`<div class="tlbar"><button class="btn mini${TL.minorHidden?' on':''}" data-tlmin title="Oculta pagos de runas, robos y pasos menores">${sym('i-eye')} Solo lo importante</button>
    <button class="btn mini" data-tlall title="Plegar o desplegar todos los turnos">${TL.collapsed.size?'Desplegar todo':'Plegar todo'}</button></div>`;
  for(const s of secs){
    const p=R.players.find(x=>x.id===s.pid), last=R.frames[s.items[s.items.length-1]].state;
    const head=s.turn!=null?`Turno ${s.turn}${p?` · <span style="color:${p.col}">${esc(p.name)}</span>`:''}`:s.label;
    html+=`<div class="tturn${TL.collapsed.has(s.key)?' collapsed':''}" data-sec="${s.key}" style="--pc:${p?.col||'var(--line2)'}">
      <div class="thead" data-goto="${s.from}"><button class="tchev" data-fold="${s.key}" title="Plegar o desplegar">${sym('i-chevron')}</button><span class="tt">${head}</span>${s.turn!=null?`<span class="tsc">${scoreLine(last)}</span>`:''}</div><div class="tbody">`;
    for(const i of s.items){
      const f=R.frames[i], log=f.newLogs[f.newLogs.length-1], {kind,major}=actionKind(log?.actionType||f.actionType, f.newLogs.map(l=>l.text).join(' '));
      const who=R.players.find(x=>x.id===(log?.authorPlayerId||f.state.activeTurnPlayerId));
      const txt=f.newLogs.length? f.newLogs.map(l=>tr(l.text)).join(' · ') : (f.actionType||'').replace(/_/g,' ');
      const mark=PROJ.marks[i], notes=PROJ.notes[i]||[];
      html+=`<div class="tl k-${kind}${major?'':' minor'}${mark?' clip':''}" data-i="${i}" title="Jugada ${i}" style="--pc:${who?.col||'var(--muted)'}">${sym(KIND_ICON[kind])}<span class="tx">${esc(txt)}</span>
        <button class="star${mark?' on':''}" data-star="${i}" title="${mark?'Quitar clip':'Marcar como clip'}">${sym('i-star')}</button></div>`;
      if(mark) html+=`<div class="tlsub tlclip" data-i="${i}" data-tab="clips">${sym('i-star')}<span>${esc(mark.label||'Clip')}</span></div>`;
      for(const n of notes) html+=`<div class="tlsub tlnote" data-i="${i}" data-tab="notas">${sym('i-note')}<span>${noteLabel(n)}</span></div>`;
    }
    html+='</div></div>';
  }
  box.innerHTML=html; box.classList.toggle('minhid',TL.minorHidden);
  buildScrubMarks();
  if(app.R.i>=0) rPos();
}

export const hudHTML = p => `<div class="hud"><div class="pname">${esc(p.name)}</div>
      <div class="stats"><div class="stat pts"><b data-k="score">0</b><span>Puntos</span></div><div class="stat"><b data-k="runes">0</b><span>Runas</span></div><div class="stat"><b data-k="hand">0</b><span>Mano</span></div><div class="stat"><b data-k="deck">0</b><span>Mazo</span></div></div>
      <div class="turnmark">SU TURNO</div></div>`;
export const ZHTML={legend:'<div class="zone z-legend" data-z="legend"><label>Leyenda</label></div>',
  trash:'<div class="zone z-trash" data-z="trash"><label>Descarte</label><span class="count">0</span></div>'};
export function rBuild(){
  const fmt=stage.className, lv=$('#rlay').value, lay=lv==='lanes'?'lanes':(fmt==='h'&&lv==='lat'?'lat':'classic'), key=fmt+'|'+lay+'|'+app.R.view+'|'+app.R.players.length;
  if(app.R.layoutKey===key) return; app.R.layoutKey=key; stage.dataset.lay=lay;
  const board=$('#rboard'); board.querySelectorAll('.rstrip,.laneb,.lhead,.rhandz').forEach(s=>s.remove());
  app.R.el=new Map(); $('#rfields').innerHTML=''; $('#rchain').innerHTML=''; $('#minimap').innerHTML=''; $('#minimap').classList.remove('show');
  const W=stage.offsetWidth, H=stage.offsetHeight;
  $('#rfields').style.gap='';
  if(lay==='lanes') return buildLanes(fmt);
  // otras distribuciones: ocupan todo el escenario; la cámara se configura al final
  setClip({x:0,y:0,w:W,h:H},true); app.R.geo=null;
  const vi=app.R.players.findIndex(p=>p.id===app.R.view);
  const order=app.R.players.map((_,k)=>app.R.players[(vi+k)%app.R.players.length]);
  const others=order.slice(1);
  let slots=[];
  if(lay==='lat'){
    // rivales en columnas laterales; campos al centro; tu tablero abajo
    const sideW=420, L=[], Rt=[];
    others.forEach((p,k)=>(k%2===0?L:Rt).push(p));
    const col=(list,x)=>list.forEach((p,k)=>slots.push({p,x,y:k*H/list.length,w:sideW,h:H/list.length,pos:'side'}));
    col(L,0); col(Rt,W-sideW);
    const cx=L.length?sideW:0, cw=W-cx-(Rt.length?sideW:0), mainTop=556;
    slots.push({p:order[0],x:cx,y:mainTop,w:cw,h:H-mainTop,pos:'main'});
    Object.assign($('#rfields').style,{left:(cx+14)+'px',top:'38px',width:(cw-28)+'px',height:(mainTop-46)+'px',flexDirection:'row'});
    Object.assign($('#rchain').style,{left:(cx+cw/2-260)+'px',top:(mainTop-160)+'px',width:'520px',height:'140px'});
  } else if(fmt==='h'){
    const bottom=[order[0]].concat(others.length>=3?[others.pop()]:[]);
    const top=others; const sh=290;
    top.forEach((p,k)=>slots.push({p,x:k*W/top.length,y:0,w:W/top.length,h:sh,pos:'top'}));
    bottom.forEach((p,k)=>slots.push({p,x:k*W/bottom.length,y:H-sh,w:W/bottom.length,h:sh,pos:'bottom'}));
    Object.assign($('#rfields').style,{left:'20px',top:'300px',width:(W-360)+'px',height:'480px',flexDirection:'row'});
    Object.assign($('#rchain').style,{left:(W-320)+'px',top:'640px',width:'300px',height:'130px'});
  } else {
    const sh=300, bh=340;
    others.forEach((p,k)=>slots.push({p,x:0,y:k*sh,w:W,h:sh,pos:'top'}));
    slots.push({p:order[0],x:0,y:H-bh,w:W,h:bh,pos:'bottom'});
    const ft=others.length*sh+10, fb=H-bh-150;
    Object.assign($('#rfields').style,{left:'20px',top:ft+'px',width:(W-40)+'px',height:(fb-ft)+'px',flexDirection:'column'});
    Object.assign($('#rchain').style,{left:'0px',top:(fb+15)+'px',width:W+'px',height:'125px'});
  }
  for(const s of slots){
    const d=document.createElement('section');
    const side=s.pos==='side', half=side&&s.h<H;
    d.className=`rstrip ${s.pos}${!side&&s.pos!=='main'&&s.w<W?' small':''}${half?' half':''}`; d.dataset.p=s.p.id;
    Object.assign(d.style,{left:s.x+'px',top:s.y+'px',width:s.w+'px',height:s.h+'px'});
    d.style.setProperty('--pc',s.p.col); d.style.setProperty('--edge',{top:'top',bottom:'bottom',main:'bottom',side:s.x?'right':'left'}[s.pos]);
    const hud=hudHTML(s.p);
    const Z={...ZHTML, handIn:'<div class="zone z-hand inl cmp" data-z="hand"><label>Mano</label></div>'};
    if(side) d.innerHTML=`${hud}<div class="srow">${Z.legend}${Z.trash}</div><div class="zone z-base fitwrap" data-z="base"><label>Base</label></div>${Z.handIn}`;
    else if(s.pos==='main') d.innerHTML=`${hud}${Z.legend}<div class="zone z-base cmp" data-z="base"><label>Base</label></div>${Z.handIn}${Z.trash}`;
    else d.innerHTML=`${hud}${Z.legend}<div class="zone z-base cmp" data-z="base"><label>Base</label></div>${Z.trash}<div class="zone z-hand cmp" data-z="hand"></div>`;
    $('#rcam').appendChild(d);
  }
  // campos de batalla: uno por jugador que eligió, en orden de asiento
  const fields=[]; app.R.players.forEach((p,k)=>{ if(p.bfCode||p.bfName) fields.push({z:BFZ[k],code:p.bfCode,name:p.bfName}); });
  app.R.fieldDefs=fields;
  fields.forEach((f,k)=>R_addField(f.z,f.code,f.name,'ABCD'[k]));
  // cámara: el área de cada jugador es su franja completa
  app.R.geo={fmt,lay,VR:{x:0,y:0,w:W,h:H},lanes:new Map()};
  document.querySelectorAll('#rcam .rstrip').forEach(s=>app.R.geo.lanes.set(s.dataset.p,offIn(s)));
  buildMinimap();
}
export function setClip(VR,clip){
  Object.assign($('#rclip').style,{left:VR.x+'px',top:VR.y+'px',width:VR.w+'px',height:VR.h+'px',overflow:clip?'hidden':'visible'});
  const c=$('#rcam'); c.style.transition='none'; c.style.transform=''; app.R.cam={s:1,tx:0,ty:0};
}

export function init() {
  $('#frames').addEventListener('click',e=>{
    const t=e.target;
    if(t.closest('[data-tlmin]')){ TL.minorHidden=!TL.minorHidden; try{ localStorage.setItem('rb_tlmin',TL.minorHidden?'1':'0'); }catch(err){} buildFrameList(); return; }
    if(t.closest('[data-tlall]')){ if(TL.collapsed.size) TL.collapsed.clear(); else $('#frames').querySelectorAll('.tturn').forEach(x=>TL.collapsed.add(x.dataset.sec)); buildFrameList(); return; }
    const fold=t.closest('[data-fold]'); if(fold){ const k=fold.dataset.fold; TL.collapsed.has(k)?TL.collapsed.delete(k):TL.collapsed.add(k); fold.closest('.tturn').classList.toggle('collapsed'); return; }
    const st=t.closest('[data-star]'); if(st){ toggleMark(+st.dataset.star); return; }
    const go=t.closest('[data-goto]'); if(go){ app.playing=false; rJump(+go.dataset.goto); return; }
    const d=t.closest('[data-i]'); if(d){ app.playing=false; rJump(+d.dataset.i); if(d.dataset.tab) switchTab(d.dataset.tab); }
  });
}
