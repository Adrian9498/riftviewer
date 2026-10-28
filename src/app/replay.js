// Generado a partir de legacy/app.js (sección "replay").
import { decodeReplay } from '../replay/decode';
import { translateLog } from '../replay/translate';
import { $, stage } from './base';
import { analyze } from './chart';
import { PROJ, loadProj, toggleMark } from './clips';
import { R_addField, buildLanes } from './layout-lanes';
import { buildMinimap, offIn, rJump, rPos, rRender } from './replay-render';
import { app } from './state';
import { esc } from './utils';

/* ================= Replays de RiftAtlas ================= */


export const BFZ=['battlefieldA','battlefieldB','battlefieldC','battlefieldToken'];
export const arr = x => !x ? [] : Array.isArray(x) ? x.filter(c=>c&&c.id) : (x.id ? [x] : []);


export const tr = t => translateLog(t, $('#rlang').value);

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
  app.R.key='rb_proj_'+(rp.replayId||(last.roomCode+':'+last.createdAt));
  loadProj(app.R.key); analyze();
  document.body.classList.add('replay');
  $('#rview').innerHTML=players.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  $('#rview').value=app.R.view;
  $('#pinfo').innerHTML=`Replay · sala <b>${esc(last.roomCode||'?')}</b> · ${players.map(p=>`<b style="color:${p.col}">${esc(p.name)}</b>`).join(' vs ')}<br>${frames.length} momentos · ${last.turnNumber||'?'} turnos`;
  buildFrameList();
  app.playing=false; app.token++;
  $('#scrub').max=frames.length-1;
  rJump($('#rskip').value==='1'?app.R.start:0);
}

export function buildFrameList(){
  const box=$('#frames'); let html='', lastTurn=null;
  app.R.frames.forEach((f,i)=>{
    const t=f.state.phase==='in_game'?f.state.turnNumber:0;
    if(t!==lastTurn){ lastTurn=t; const ap=app.R.players.find(p=>p.id===f.state.activeTurnPlayerId); html+=`<div class="turn">${t?`TURNO ${t}${ap?` · <span style="color:${ap.col}">${ap.name}</span>`:''}`:'PREPARACIÓN'}</div>`; }
    const txt=f.newLogs.length? f.newLogs.map(l=>tr(l.text)).join(' · ') : (f.actionType||'').replace(/_/g,' ');
    const nn=(PROJ.notes[i]||[]).length;
    html+=`<div data-i="${i}"><span class="star${PROJ.marks[i]?' on':''}" data-star="${i}" title="Marcar como clip">${PROJ.marks[i]?'★':'☆'}</span>${i}. ${txt.replace(/</g,'&lt;')}${nn?`<span class="nb" title="Notas">✎${nn}</span>`:''}</div>`;
  });
  box.innerHTML=html;
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
    const st=e.target.closest('[data-star]'); if(st){ toggleMark(+st.dataset.star); return; }
    const d=e.target.closest('[data-i]'); if(d){ app.playing=false; rJump(+d.dataset.i); }
  });
}
