// Generado a partir de legacy/app.js (sección "replay-render").
import { computeCamera, padTarget as padRect, union } from '../replay/camera';
import { newBattles, scoreDeltas } from '../replay/events';
import { arrowsKeyOf, clearTargetArrows, drawTargetArrows, finishMulligan, newArrowTargets, paintFieldSums, paintLegendXp, renderMulligan } from './replay-extras';
import { $, ic, stage } from './base';
import { cardTextHTML } from '../data/symbols';
import { posLabel } from './transport';
import { innerRect, scale } from './fit';
import { R_addField, compress, fitCells, fitField, fitWrap, rCardEl, rPaint } from './layout-lanes';
import { PICK, renderNotes, runNotes, runQuiz } from './notes';
import { BFZ, TL, arr, rBuild, startFrame, tr } from './replay';
import { banner, el, floatText, log, place, wait } from './script-engine';
import { SFX } from './sounds';
import { app } from './state';
import { summarySequence } from './summary';
import { esc } from './utils';
// cuánto espera la reproducción para que se vea una flecha de objetivo nueva (Ajustes → Reproducción → Flechas)
const arrowHoldMs = () => +($('#rarrow')?.value ?? 1200);

/* ---- Cámara que sigue la acción + minimapa ---- */
export function camNow(){ const c=$('#rcam'); return c.offsetWidth ? c.getBoundingClientRect().width/(c.offsetWidth*scale()) : 1; }
export function offIn(el){ let x=0,y=0,e=el; while(e && e.id!=='rcam'){ x+=e.offsetLeft; y+=e.offsetTop; e=e.offsetParent; } return {x,y,w:el.offsetWidth,h:el.offsetHeight}; }
const padTarget = T => padRect(T, app.R.geo.VR);
/** Encuadra varios elementos a la vez (p. ej. origen y destino de una flecha) y espera a que la cámara llegue. */
export async function frameElements(els){
  if(!app.R?.geo) return;
  const inCam=els.filter(e=>e && e.closest && e.closest('#rcam'));   // la mano fija (fuera de la cámara) siempre se ve
  if(!inCam.length) return;
  camTo(padTarget(union(inCam.map(offIn))));
  await new Promise(r=>setTimeout(r,800/app.speed));
}
// zona de un jugador: sus cartas en la base (o su franja si no hay ninguna)
export function laneTarget(pid){
  const s=$(`#rcam .rstrip[data-p="${pid}"]`); if(!s) return app.R.geo.lanes.get(pid);
  const cards=[...s.querySelectorAll('[data-z=base] .card')].map(offIn);
  return cards.length ? padTarget(union(cards)) : app.R.geo.lanes.get(pid);
}
export function fieldTarget(z){
  const fe=$(`#rfields .rfield[data-z="${z}"]`); if(!fe) return null;
  const cells=[...fe.querySelectorAll('.grp > .card')].map(offIn);
  if(!cells.length) return offIn(fe);
  // el título del campo se incluye salvo en carriles horizontales, donde puede quedar lejos de las celdas
  const T=union(cells), head=offIn(fe.querySelector('.fhead'));
  const y0=(app.R.geo.lay==='lanes'&&app.R.geo.fmt==='h')?T.y:Math.min(T.y,head.y); return padTarget({x:T.x,y:y0,w:T.w,h:T.y+T.h-y0});
}
// decide a dónde mirar: undefined = no mover; null = vista completa
export function camFocus(f,st,prev,zoneOf,prevZone){
  if(st.phase==='in_game' && prev.activeTurnPlayerId!==st.activeTurnPlayerId) return null;
  // una flecha nueva de la cadena: encuadrar lo que apunta
  const aimed=newArrowTargets(st,prev)?.filter(e=>e.closest('#rcam'));
  if(aimed?.length) return padTarget(union(aimed.map(offIn)));
  const conq=f.newLogs.find(l=>/conquered/.test(l.text));
  if(conq){ const fd=app.R.fieldDefs.find(x=>x.name&&conq.text.includes(x.name)); if(fd) return fieldTarget(fd.z); }
  let lane;
  for(const [id,z] of zoneOf){ const pz=prevZone.get(id); if(!pz || pz===z) continue;
    if(BFZ.includes(z)) return fieldTarget(z);
    if(BFZ.includes(pz)) return fieldTarget(pz);
    if(z==='base' && ['hand','legend'].includes(pz)) lane=laneTarget(app.R.el.get(id)?._owner); }
  return lane || undefined;
}
export function camTo(T,instant){
  const c=$('#rcam'), g=app.R.geo; if(!g) return;
  const {s,tx,ty}=computeCamera(T,g.VR,$('#rcamsel').value);
  c.style.transition=instant?'none':`transform ${750/app.speed}ms cubic-bezier(.45,.05,.2,1)`;
  c.style.transform=s===1?'':`translate(${tx}px,${ty}px) scale(${s})`;
  app.R.cam={s,tx,ty}; updMinimap();
}
export function buildMinimap(){
  const g=app.R.geo, mm=$('#minimap'); if(!g) return;
  const VR=g.VR, w=g.fmt==='h'?280:230, h=w*VR.h/VR.w;
  let body='';
  app.R.players.forEach(p=>{ const l=$(`#rcam .laneb[data-p="${p.id}"]`)||$(`#rcam .rstrip[data-p="${p.id}"]`); if(l){ const r=offIn(l); body+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${p.col}" fill-opacity=".28"/>`; } });
  document.querySelectorAll('#rfields .rfield').forEach(fe=>{ const r=offIn(fe); body+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="#ffffff" stroke-opacity=".45" stroke-width="6" rx="10"/>`; });
  mm.innerHTML=`<svg viewBox="0 0 ${VR.w} ${VR.h}" width="${w}" height="${h}">${body}<rect id="mmv" fill="none" stroke="#f2c14e" stroke-width="10" rx="8"/></svg>`;
  Object.assign(mm.style,{right:'16px',top:(VR.h-h-16)+'px'});
}
export function updMinimap(){
  const mm=$('#minimap'), v=$('#mmv'), c=app.R.cam; if(!v||!app.R.geo) return;
  const VR=app.R.geo.VR;
  v.setAttribute('x',-c.tx/c.s); v.setAttribute('y',-c.ty/c.s); v.setAttribute('width',VR.w/c.s); v.setAttribute('height',VR.h/c.s);
  mm.classList.toggle('show',c.s>1);
}
export const center = r => [r.left+r.width/2, r.top+r.height/2];
export const fmtXform = ex => ex?'rotate(90deg) scale(.86)':'none';

export async function rRender(i,anim){
  const f=app.R.frames[i]; if(!f) return;
  rBuild();
  const st=f.state, prev=app.R.shown, sc=scale();
  const before=new Map(); if(anim) app.R.el.forEach((e,id)=>{ if(e.isConnected) before.set(id,{r:e.getBoundingClientRect(),ex:e.classList.contains('exhausted')}); });
  const prevZone=app.R.zoneOf||new Map(); const zoneOf=new Map(); const place=[]; // [el, container, zone]
  const strips={}; document.querySelectorAll('.rstrip').forEach(s=>strips[s.dataset.p]=s);
  const counts={};
  for(const p of st.players){
    const b=p.board||{}, s=strips[p.id]; if(!s) continue;
    const add=(cards,zone,box)=>cards.forEach(c=>{ const e=rCardEl(c,p.id); place.push([e,box,zone]); zoneOf.set(c.id,zone); });
    add(arr(b.legend).concat(arr(b.champion)),'legend',s.querySelector('[data-z=legend]'));
    add(arr(b.base),'base',s.querySelector('[data-z=base]'));
    const trash=arr(b.trash); add(trash.slice(-1),'trash',s.querySelector('[data-z=trash]'));
    trash.slice(0,-1).forEach(c=>zoneOf.set(c.id,'trash'));
    add(arr(b.hand),'hand',s._hand||s.querySelector('[data-z=hand]'));
    BFZ.forEach(z=>{ const cards=arr(b[z]); if(!cards.length) return;
      let fe=$(`#rfields .rfield[data-z=${z}]`); if(!fe) fe=R_addField(z,null,z==='battlefieldToken'?'Campo extra':z.slice(-1),z.slice(-1));
      add(cards,z,fe.querySelector(`.grp[data-p="${p.id}"]`)); });
    const runes=arr(b.runeArea);
    // runas listas/total, más la energía y el poder que quedaron flotando este turno
    const pool=(b.floatingEnergy?` +${b.floatingEnergy}⚡`:'')+(b.floatingPower?` +${b.floatingPower}◆`:'');
    counts[p.id]={score:b.score||0,runes:`${runes.filter(r=>!r.exhausted).length}/${runes.length}${pool}`,hand:arr(b.hand).length,deck:arr(b.deck).length,trash:trash.length};
  }
  // cadena
  for(const ce of arr(st.chainEntries)){
    const card=ce.card||ce; const id=(ce.sourceCardId && !zoneOf.has(ce.sourceCardId))?ce.sourceCardId:card.id;
    const owner=ce.byPlayerId||card.ownerPlayerId;
    const e=rCardEl({...card,id},owner); place.push([e,$('#rchain'),'chain']); zoneOf.set(id,'chain');
  }
  // quitar cartas que ya no se ven
  const keep=new Set(place.map(x=>x[0]));
  app.R.el.forEach((e,id)=>{ if(!keep.has(e)){
    if(anim && e.isConnected){ const r=e.getBoundingClientRect(), sr=innerRect();
      e.style.position='absolute'; e.style.left=((r.left-sr.left)/sc)+'px'; e.style.top=((r.top-sr.top)/sc)+'px'; e.style.margin='0';
      $('#fx').appendChild(e); e.classList.add('gone'); setTimeout(()=>e.remove(),500/app.speed); }
    else e.remove();
    app.R.el.delete(id); } });
  // colocar
  for(const [e,box,zone] of place){
    if(e._new && anim){ const s=strips[e._owner]; const hud=s?.querySelector('[data-k=deck]'); if(hud && zone==='hand') before.set(e._card.id,{r:hud.getBoundingClientRect(),ex:false}); }
    e._new=false; e.style.position=''; e.style.left=''; e.style.top='';
    if(zone==='trash') box.insertBefore(e,box.querySelector('.count')); else box.appendChild(e);
    rPaint(e,zone);
  }
  document.querySelectorAll('#rfields .rfield').forEach(stage.dataset.lay==='lanes'?fitCells:fitField);
  document.querySelectorAll('#rboard .cmp').forEach(b=>compress(b, b.dataset.z==='hand'&&!b.classList.contains('inl')&&b.closest('.rstrip') ? b.closest('.rstrip').clientWidth*0.55 : 0));
  document.querySelectorAll('#rboard .fitwrap').forEach(fitWrap);
  paintFieldSums();
  // HUD
  for(const pid in counts){ const s=strips[pid], c=counts[pid];
    for(const k of ['score','runes','hand','deck']) s.querySelector(`[data-k=${k}]`).textContent=c[k];
    s.querySelector('.count').textContent=c.trash;
    s.classList.toggle('active',st.activeTurnPlayerId===pid && st.phase==='in_game');
    document.querySelector(`.laneb[data-p="${pid}"]`)?.classList.toggle('active',st.activeTurnPlayerId===pid && st.phase==='in_game'); }
  paintLegendXp(st,prev,anim);
  renderMulligan(i,anim);
  // control de campos (unidades de un solo jugador)
  document.querySelectorAll('#rfields .rfield').forEach(fe=>{
    const z=fe.dataset.z, who=st.players.filter(p=>arr(p.board?.[z]).length).map(p=>p.id);
    if(who.length===1) app.R.ctrl[z]=who[0];
    const cp=app.R.players.find(p=>p.id===app.R.ctrl[z]);
    fe.classList.toggle('ctrl',!!cp); if(cp) fe.style.setProperty('--pc',cp.col);
    fe.querySelector('.fown').textContent=cp?cp.name:'';
  });
  const ap=app.R.players.find(p=>p.id===st.activeTurnPlayerId);
  $('#turninfo').textContent=st.phase==='in_game'?`TURNO ${st.turnNumber}${ap?' · '+ap.name.toUpperCase():''}`:'PREPARACIÓN';
  // FLIP
  if(anim){
    const cs=sc*camNow();   // las cartas dentro de la cámara están escaladas además por el zoom
    app.R.el.forEach((e,id)=>{
      const b=before.get(id), ex=e.classList.contains('exhausted');
      if(!b){ e.animate([{opacity:0,transform:'scale(1.3)'},{opacity:1,transform:fmtXform(ex)}],{duration:400/app.speed}); return; }
      const [ox,oy]=center(b.r), [nx,ny]=center(e.getBoundingClientRect()), k=e.closest('#rcam')?cs:sc;
      const dx=(ox-nx)/k, dy=(oy-ny)/k;
      if(Math.abs(dx)>1||Math.abs(dy)>1||b.ex!==ex)
        e.animate([{transform:`translate(${dx}px,${dy}px) ${fmtXform(b.ex)}`},{transform:fmtXform(ex)}],{duration:550/app.speed,easing:'cubic-bezier(.3,.7,.3,1)'});
    });
  }
  // cámara: se acerca a donde pasa la jugada
  if(app.R.geo){
    if(!anim || !prev) camTo(null,!anim);
    else { const f2=camFocus(f,st,prev,zoneOf,prevZone); if(f2!==undefined) camTo(f2); }
  }
  app.R.zoneOf=zoneOf;
  const prevI=app.R.i; app.R.i=i; app.R.shown=st; rPos();
  // flechas de objetivo: se dibujan cuando las cartas y la cámara terminan de moverse
  // si siguen siendo las mismas flechas (la cadena dura varias jugadas), se quedan y solo se reacomodan;
  // antes se borraban en cada jugada y al reproducir seguido nunca alcanzaban a aparecer
  const ak=arrowsKeyOf(st), layer=$('#tarrows'), same=!!ak && layer.dataset.key===ak;
  if(!same){
    // al resolverse, se desvanecen en lugar de desaparecer de golpe
    if(anim && !ak && layer.innerHTML){ layer.classList.add('out'); const tok=app.token; setTimeout(()=>{ if(tok===app.token && layer.classList.contains('out')) clearTargetArrows(); },450); }
    else clearTargetArrows();
    if(ak){ layer.classList.remove('out'); layer.dataset.key=ak; }
  }
  // flechas nuevas: la reproducción espera a que se vean al menos un momento (Ajustes → Reproducción)
  if(anim && ak && !same) app.R.arrowHold=performance.now()+(850+arrowHoldMs())/app.speed;
  if(ak){
    const tok=app.token, draw=()=>{ if(tok===app.token && app.R?.shown===st) drawTargetArrows(st,same); };
    if(anim) setTimeout(draw,(same?560:850)/app.speed); else drawTargetArrows(st,same);
  }
  const out=st.gameOutcome?.winnerPlayerIds;
  if(!anim){ $('#victory').classList.toggle('show',!!(out&&out.length&&i===app.R.frames.length-1)); if(out&&i===app.R.frames.length-1) rVictory(out); return; }
  $('#victory').classList.remove('show');

  /* ---- efectos ---- */
  const logs=f.newLogs.map(l=>tr(l.text));
  logs.forEach(t=>{ const who=app.R.players.find(p=>t.startsWith(p.name)); log(t.replace(/</g,'&lt;')); if(who) $('#log').lastChild.style.borderLeft=`3px solid ${who.col}`; });
  let t=450;
  if(prev && st.phase==='in_game' && prev.activeTurnPlayerId!==st.activeTurnPlayerId && ap){
    await banner(`TURNO ${st.turnNumber}<small style="color:${ap.col}">${ap.name.toUpperCase()}</small>`,1100); }
  // carta jugada (de mano/campeón a mesa o cadena)
  const played=[...zoneOf].find(([id,z])=>['hand','legend'].includes(prevZone.get(id)) && ['base','chain',...BFZ].includes(z));
  // inicio de batalla: un campo pasa a tener unidades de dos o más jugadores
  for(const z of newBattles(prev,st,BFZ)){
    const fe=$(`#rfields .rfield[data-z=${z}]`), fd=app.R.fieldDefs.find(x=>x.z===z);
    SFX.play('battle'); if(fe){ fe.classList.remove('clash'); void fe.offsetWidth; fe.classList.add('clash'); }
    await banner(`⚔ ¡BATALLA!<small>${esc((fd?.name||'Campo de batalla').toUpperCase())}</small>`,1000); }
  const conq=f.newLogs.find(l=>/conquered/.test(l.text));
  let gained=false;
  for(const {id,delta:d} of scoreDeltas(prev,st)){ const s=strips[id]; if(!s) continue;
    floatText(s.querySelector('[data-k=score]'),(d>0?'+':'')+d,'#f2c14e'); t=Math.max(t,900); if(d>0) gained=true; }
  if(gained && !conq) SFX.play('point');   // punto por hold (o cualquier punto sin conquista)
  if(conq){ const fd=app.R.fieldDefs.find(x=>x.name&&conq.text.includes(x.name)); const fe=fd&&$(`#rfields .rfield[data-z=${fd.z}]`);
    const who=app.R.players.find(p=>conq.text.startsWith(p.name));
    if(fe){ fe.classList.remove('flash'); void fe.offsetWidth; fe.classList.add('flash'); }
    SFX.play('conquest');
    if(who) await banner(`<span style="color:${who.col}">¡CONQUISTA!</span><small>${who.name.toUpperCase()}${fd?' · '+fd.name.toUpperCase():''}</small>`,1100);
    if(gained) SFX.play('point'); }
  if($('#rcap').value==='1' && logs.length){ const cp=$('#caption'); cp.textContent=logs.join(' · '); cp.classList.add('show'); }
  if(played){ const e=app.R.el.get(played[0]); if(e&&e._data){ const who=app.R.players.find(p=>p.id===e._owner);
    e.classList.add('highlight'); await rSpot(e._data,who,1500); e.classList.remove('highlight'); } }
  await wait(t);
  if($('#rcap').value==='1') $('#caption').classList.remove('show');
  await finishMulligan(i);
  if(out&&out.length&&!prev?.gameOutcome){ rVictory(out); $('#victory').classList.add('show'); await wait(2500);
    if($('#rauto').value==='1' && i===app.R.frames.length-1){ await summarySequence(); } }
}
export function rVictory(ids){ $('#victory').querySelector('p').innerHTML=ids.map(id=>{ const p=app.R.players.find(x=>x.id===id); return p?`<b style="color:${p.col}">${p.name}</b>`:''; }).join(' & '); }
export async function rSpot(data,who,ms){
  const s=$('#spot'); s.querySelector('.who').textContent=who?`${who.name} juega`:''; s.querySelector('.who').style.color=who?.col||'';
  const img=s.querySelector('img'); img.style.display=''; img.src=data.img; s.querySelector('.txt').innerHTML=cardTextHTML(data.rich,data.text);
  s.classList.add('show'); await wait(ms); s.classList.remove('show');
}
export function rPos(){
  $('#pos').textContent=posLabel(app.R.i); $('#pos').title=`Jugada ${app.R.i} de ${app.R.frames.length-1}`; $('#scrub').value=app.R.i;
  document.dispatchEvent(new Event('rb:pos'));
  $('#bPlay').innerHTML=app.playing?ic('pause')+' Pausa':ic('play')+' Reproducir';
  const box=$('#frames'); box.querySelector('.cur')?.classList.remove('cur');
  const d=box.querySelector(`.tl[data-i="${app.R.i}"]`);
  if(d){ const tt=d.closest('.tturn'); if(tt?.classList.contains('collapsed')){ tt.classList.remove('collapsed'); TL.collapsed.delete(tt.dataset.sec); }   // el turno actual siempre a la vista
    d.classList.add('cur'); d.scrollIntoView({block:'nearest'}); }
  if($('#tnotas').classList.contains('on') && !PICK) renderNotes();
}
export function rJump(i){
  app.token++; i=Math.max(0,Math.min(app.R.frames.length-1,i));
  ['#spot','#caption','#banner'].forEach(s=>$(s).classList.remove('show')); $('#log').innerHTML='';
  document.querySelectorAll('.ov').forEach(o=>o.classList.remove('show')); $('#fx').innerHTML=''; clearTargetArrows();
  app.R.shown=null; app.R.zoneOf=null; rRender(i,false);
}
export async function rStep(){
  if(app.R.i>=app.R.frames.length-1) return false;
  const my=app.token, n=app.R.i+1;
  await runQuiz(n); if(my!==app.token) return false;
  await rRender(n,true); if(my!==app.token) return false;
  const hold=(app.R.arrowHold||0)-performance.now(); if(hold>0){ await new Promise(r=>setTimeout(r,hold)); if(my!==app.token) return false; }
  await runNotes(n); return my===app.token;
}
export async function rPlay(){
  if(app.playing){ app.playing=false; rPos(); return; }
  if(app.R.i>=app.R.frames.length-1) rJump(startFrame());
  app.playing=true; rPos(); const my=app.token;
  while(app.playing && my===app.token && app.R.i<app.R.frames.length-1){ if(!await rStep()) break; await wait(150); }
  if(my===app.token){ app.playing=false; rPos(); }
}