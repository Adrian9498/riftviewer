// Generado a partir de legacy/app.js (sección "script-engine").
import { norm } from '../data/text';
import { cardTextHTML } from '../data/symbols';
import { isSetup, parse } from '../script/parser';
import { $, ic } from './base';
import { findCard } from './cards';
import { renderClips } from './clips';
import { innerRect, scale } from './fit';
import { PICK, renderNotes, runNotes, runQuiz } from './notes';
import { DOC, autosaveScript } from './shell';
import { SFX } from './sounds';
import { app } from './state';
import { esc } from './utils';

/* ================= Estado / render ================= */
export let STEPS=[], idx=0, uid=0;
export let G; // estado del juego
export const el = {};          // id -> element
export const fieldsEl=$('#fields');

export function reset(){
  G={players:{1:{name:'Jugador 1',pts:0,runes:0},2:{name:'Jugador 2',pts:0,runes:0}},cards:{},fields:{},goal:8,turn:0,active:0};
  uid=0;   // ids estables entre reconstrucciones, para que las notas sigan apuntando a la misma carta
  Object.values(el).forEach(e=>e.remove()); for(const k in el) delete el[k];
  fieldsEl.innerHTML=''; $('#log').innerHTML=''; $('#victory').classList.remove('show');
  ['#spot','#caption','#banner'].forEach(s=>$(s).classList.remove('show'));
  updateHud();
}
export function zoneEl(owner,zone){
  if(['A','B','C'].includes(zone)){
    const f=G.fields[zone]||makeField(zone);
    return f.querySelector(owner===1?'.s1':'.s2');
  }
  return $(`#P${owner} [data-z="${zone}"]`);
}
export function makeField(F){
  const d=document.createElement('div'); d.className='field'; d.dataset.f=F;
  d.innerHTML=`<div class="side s2"></div><div class="mid"><span class="flabel">${F}</span><span class="bfname"></span><span class="owner"></span></div><div class="side s1"></div>`;
  const order=['A','B','C']; const after=[...fieldsEl.children].find(c=>order.indexOf(c.dataset.f)>order.indexOf(F));
  fieldsEl.insertBefore(d,after||null); G.fields[F]=d; d._ctrl=0; return d;
}
export function newCard(owner,name,zone,known=true){
  const id='c'+(++uid);
  const data = known? findCard(name) : null;
  const c={id,owner,name,zone,data,known,dmg:0,buff:0,ex:false};
  G.cards[id]=c;
  const e=document.createElement('div'); e.className='card '+(owner===1?'p1u':'p2u'); el[id]=e; e._cid=id;
  if(known){ e.dataset.ikey='card:n:'+norm(name); e.dataset.iname=name; }
  e.innerHTML='<div class="face"></div>';
  paintCard(c);
  return c;
}
export function paintCard(c){
  const e=el[c.id], f=e.querySelector('.face');
  e._data=c.data; e._iname=c.name;
  const back = !c.known;
  e.classList.toggle('back',back);
  e.classList.toggle('exhausted',c.ex);
  if(back){ f.style.backgroundImage=''; f.className='face'; f.textContent=''; }
  else if(c.data){ f.className='face'; f.textContent=''; f.style.backgroundImage=`url("${c.data.img}")`; }
  else { f.className='face ph'; f.style.backgroundImage=''; f.textContent=c.name; }
  let d=e.querySelector('.dmg'); if(c.dmg>0){ if(!d){d=document.createElement('div');d.className='dmg';e.appendChild(d);} d.textContent=c.dmg; } else d?.remove();
  let b=e.querySelector('.buff'); if(c.buff){ if(!b){b=document.createElement('div');b.className='buff';e.appendChild(b);} b.textContent=(c.buff>0?'+':'')+c.buff; } else b?.remove();
}
/* Mueve una carta a una zona con animación FLIP */
export function place(c,zone,anim){
  const e=el[c.id]; const first=e.isConnected? e.getBoundingClientRect():null;
  c.zone=zone; const z=zoneEl(c.owner,zone);
  if(zone==='trash') z.insertBefore(e,z.querySelector('.count')); else z.appendChild(e);
  paintCard(c);
  if(anim && first){
    const last=e.getBoundingClientRect(), sc=scale();
    const dx=(first.left-last.left)/sc, dy=(first.top-last.top)/sc;
    if(dx||dy){
      e.animate([{transform:`translate(${dx}px,${dy}px)${c.ex?' rotate(90deg) scale(.86)':''}`},{transform:c.ex?'rotate(90deg) scale(.86)':'none'}],{duration:550/app.speed,easing:'cubic-bezier(.3,.7,.3,1)'});
    }
  } else if(anim){
    e.animate([{opacity:0,transform:'scale(1.4)'},{opacity:1,transform:'none'}],{duration:400/app.speed});
  }
  updateHud();
}
export function findInst(name,owner,prefZones){
  let [base,n]=name.split('#'); n=parseInt(n||'1'); const k=norm(base);
  const data=findCard(base);
  let list=Object.values(G.cards).filter(c=>c.known && c.zone!=='gone' && (!owner||c.owner===owner) && (norm(c.name)===k || (data&&c.data===data)));
  if(prefZones){ const p=list.filter(c=>prefZones.includes(c.zone)); if(p.length) list=p; }
  return list[n-1]||list[0];
}
export function handCards(o){ return Object.values(G.cards).filter(c=>c.owner===o&&c.zone==='hand'); }
export function updateHud(){
  for(const o of [1,2]){
    const p=G.players[o];
    $('#n'+o).textContent=p.name; $('#s'+o).textContent=p.pts; $('#r'+o).textContent=p.runes;
    $('#h'+o).textContent=handCards(o).length;
    $(`#P${o} .z-trash .count`).textContent=Object.values(G.cards).filter(c=>c.owner===o&&c.zone==='trash').length;
    $('#P'+o).classList.toggle('active',G.active===o);
  }
  for(const F in G.fields){ const f=G.fields[F]; f.classList.toggle('c1',f._ctrl===1); f.classList.toggle('c2',f._ctrl===2); f.querySelector('.owner').textContent=f._ctrl?G.players[f._ctrl].name:''; }
  $('#turninfo').textContent=G.turn?`TURNO ${G.turn}  ·  META ${G.goal} PUNTOS`:'';
}

/* ================= Efectos ================= */
export const wait = ms => new Promise(r=>setTimeout(r,ms/app.speed));
export function log(t,o){ const d=document.createElement('div'); d.innerHTML=t; if(o) d.style.borderLeft=`3px solid var(--p${o})`; const L=$('#log'); L.appendChild(d); while(L.children.length>6) L.firstChild.remove(); }
export async function spotlight(c,who,ms=1600){
  const s=$('#spot');
  s.querySelector('.who').textContent=who||''; s.querySelector('.who').style.color=c.owner?`var(--p${c.owner})`:'';
  const img=s.querySelector('img'); img.style.display=c.data?'':'none'; if(c.data) img.src=c.data.img;
  s.querySelector('.txt').innerHTML=c.data?cardTextHTML(c.data.rich,c.data.text):esc(c.name);
  s.classList.add('show'); await wait(ms); s.classList.remove('show');
}
export function floatText(target,text,color){
  const r=target.getBoundingClientRect(), sr=innerRect(), sc=scale();
  const d=document.createElement('div'); d.className='float'; d.textContent=text; d.style.color=color;
  d.style.left=((r.left-sr.left)/sc + r.width/sc/2 - 20)+'px'; d.style.top=((r.top-sr.top)/sc)+'px';
  d.style.animationDuration=(1.1/app.speed)+'s';
  $('#fx').appendChild(d); setTimeout(()=>d.remove(),1200/app.speed);
}
export async function banner(html,ms=1300){ const b=$('#banner'); b.innerHTML=html; b.classList.add('show'); await wait(ms); b.classList.remove('show'); await wait(250); }
export const nm = c => `<b>${c.data?.name||c.name}</b>`;
export const pn = o => `<b style="color:var(--p${o})">${G.players[o].name}</b>`;

/* ================= Ejecución de pasos ================= */
export async function exec(s,anim){
  const o=s.pl, pl=o&&G.players[o];
  const n=s.num!==undefined?parseFloat(s.num):undefined;
  const rel=(cur)=>/^[+-]/.test(s.num)?cur+n:n;
  const getCard=(owner,zones)=>{ const c=findInst(s.q,owner,zones); if(!c) throw new Error(`Línea ${s.line}: no hay "${s.q}" en la mesa`); return c; };
  switch(s.cmd){
    case 'jugador': pl.name=s.q||pl.name; updateHud(); break;
    case 'meta': G.goal=n; updateHud(); break;
    case 'leyenda': place(newCard(o,s.q,'legend'),'legend',false); break;
    case 'campeon': place(newCard(o,s.q,'champ'),'champ',false); break;
    case 'campo': {
      const f=G.fields[s.field]||makeField(s.field); const d=findCard(s.q);
      const mid=f.querySelector('.mid'); mid.querySelector('img')?.remove();
      if(d){ const im=document.createElement('img'); im.className='bfimg'; im.src=d.img; mid.prepend(im); }
      f.querySelector('.bfname').textContent=d?.name||s.q; break; }
    case 'mano': for(let i=0;i<n;i++) place(newCard(o,'?','hand',false),'hand',false); break;
    case 'turno':
      G.turn++; G.active=o; updateHud();
      if(anim) await banner(`TURNO ${G.turn}<small style="color:var(--p${o})">${pl.name.toUpperCase()}</small>`);
      break;
    case 'fase': if(anim) await banner(`<span style="font-size:44px">${s.q.toUpperCase()}</span>`,900); break;
    case 'roba': {
      const k=s.q?1:(n||1);
      for(let i=0;i<k;i++){
        const c=newCard(o,s.q||'?','hand',!!s.q);
        if(anim){ const deck=$(`#P${o} .hud`); deck.appendChild(el[c.id]); el[c.id].style.position='absolute'; }
        el[c.id].style.position=''; place(c,'hand',anim);
        if(anim) await wait(250);
      }
      if(anim) log(`${pn(o)} roba ${s.q?nm({name:s.q,data:findCard(s.q)}):k+' carta'+(k>1?'s':'')}`,o);
      break; }
    case 'runas': { pl.runes=Math.max(0,rel(pl.runes)); updateHud(); if(anim){ floatText($('#r'+o),(/^[+-]/.test(s.num)?s.num:'='+n)+' ◆','#7fd3ff'); await wait(500);} break; }
    case 'juega': {
      let c=findInst(s.q,o,['hand']);
      if(!c||c.zone!=='hand'){ const h=handCards(o).find(x=>!x.known); c=newCard(o,s.q,'hand'); if(h){ el[c.id].remove(); h.zone='gone'; el[h.id].replaceWith(el[c.id]); } }
      c.known=true; c.name=s.q; c.data=findCard(s.q);
      const destZone = s.dest ? (s.dest.toLowerCase()==='base'?'base':s.dest.toUpperCase()) : (c.data&&['Unit','Gear'].includes(c.data.type)?'base':'trash');
      if(anim){ log(`${pn(o)} juega ${nm(c)}`,o); paintCard(c); await spotlight(c,`${pl.name} juega`); }
      place(c,destZone,anim); if(anim) await wait(450);
      if(handCards(o).length===0) {}
      break; }
    case 'mueve': {
      const c=getCard(o,['base','A','B','C']); const dz=s.dest.toLowerCase()==='base'?'base':s.dest.toUpperCase();
      place(c,dz,anim); if(anim){ log(`${pn(o)} mueve ${nm(c)} → ${dz==='base'?'Base':'Campo '+dz}`,o); await wait(600);} break; }
    case 'agota': case 'prepara': {
      if(s.words.some(w=>w.toLowerCase()==='todo')){
        Object.values(G.cards).filter(c=>c.owner===o).forEach(c=>{c.ex=false;paintCard(c);});
        if(anim){ log(`${pn(o)} prepara todo`,o); await wait(500);} break;
      }
      const c=getCard(o); c.ex = s.cmd==='agota'; paintCard(c); if(anim) await wait(450); break; }
    case 'dano': {
      const c=getCard(o,['A','B','C','base','champ','legend']); c.dmg+=n; paintCard(c);
      if(anim){ el[c.id].classList.remove('hit'); void el[c.id].offsetWidth; el[c.id].classList.add('hit'); floatText(el[c.id],'-'+n,'#ff5252'); log(`${nm(c)} recibe ${n} de daño`,c.owner); await wait(700);} break; }
    case 'cura': { const c=getCard(o); c.dmg=0; paintCard(c); if(anim){ floatText(el[c.id],'✚','#45d483'); await wait(500);} break; }
    case 'poder': { const c=getCard(o); c.buff=rel(c.buff); paintCard(c); if(anim){ floatText(el[c.id],(n>0?'+':'')+n,'#45d483'); await wait(600);} break; }
    case 'combate': {
      const f=G.fields[s.field]; if(!f) throw new Error(`Línea ${s.line}: el campo ${s.field} no existe`);
      if(anim){ log(`⚔ Combate en el campo <b>${s.field}</b>`); SFX.play('battle'); await banner('⚔ COMBATE <small>CAMPO '+s.field+'</small>',1000);
        f.classList.remove('clash'); void f.offsetWidth; f.classList.add('clash'); await wait(1200); } break; }
    case 'conquista': case 'controla': {
      const f=G.fields[s.field]||makeField(s.field); f._ctrl=o; updateHud();
      if(anim){ if(s.cmd==='conquista'){ f.classList.remove('flash'); void f.offsetWidth; f.classList.add('flash'); SFX.play('conquest'); log(`${pn(o)} conquista el campo <b>${s.field}</b>`,o); await banner(`<span style="color:var(--p${o})">¡CONQUISTA!</span><small>${pl.name.toUpperCase()} · CAMPO ${s.field}</small>`,1200);} else await wait(400); }
      break; }
    case 'libera': { const f=G.fields[s.field]; if(f){ f._ctrl=0; updateHud(); } break; }
    case 'muere': {
      const c=getCard(o,['A','B','C','base','champ']);
      if(anim){ log(`💀 ${nm(c)} es destruida`,c.owner); el[c.id].classList.add('dying'); await wait(600); el[c.id].classList.remove('dying'); }
      c.dmg=0; c.buff=0; c.ex=false; place(c,'trash',false); break; }
    case 'regresa': { const c=getCard(o,['A','B','C','base','trash']); c.dmg=0;c.buff=0;c.ex=false; place(c,'hand',anim); if(anim) await wait(500); break; }
    case 'puntos': {
      pl.pts=rel(pl.pts); updateHud();
      if(anim){ if(!/^-/.test(s.num)) SFX.play('point'); floatText($('#s'+o),(/^[+-]/.test(s.num)?s.num:'='+n),'#f2c14e'); log(`${pn(o)} ${/^-/.test(s.num)?'pierde':'gana'} puntos → ${pl.pts}`,o); await wait(800);} break; }
    case 'foco': { const c=findInst(s.q,o)||{name:s.q,data:findCard(s.q)}; if(anim){ if(el[c.id]) el[c.id].classList.add('highlight'); await spotlight(c,'',1800); if(el[c.id]) el[c.id].classList.remove('highlight'); } break; }
    case 'texto': if(anim){ const cp=$('#caption'); cp.textContent=s.q; cp.classList.add('show'); await wait(Math.max(1800,s.q.length*55)); cp.classList.remove('show'); await wait(250);} break;
    case 'pausa': if(anim) await wait((n||1)*1000); break;
    case 'gana': { const v=$('#victory'); v.querySelector('p').innerHTML=pn(o); v.classList.add('show'); if(anim) await wait(2500); break; }
  }
}

/* Reconstruye el estado hasta el paso i sin animar */
export async function jumpTo(i){
  app.token++; reset();
  idx=0;
  while(idx<STEPS.length && (idx<i || isSetup(STEPS[idx]))){
    try{ await exec(STEPS[idx],false); }catch(e){ showRuntime(e); }
    idx++;
  }
  ['#spot','#caption','#banner'].forEach(s=>$(s).classList.remove('show'));
  if(idx<STEPS.length || !STEPS.some(s=>s.cmd==='gana')) $('#victory').classList.remove('show');
  updatePos();
}
export async function stepForward(){
  if(idx>=STEPS.length) return false;
  const my=app.token, n=idx;
  await runQuiz(n); if(my!==app.token) return false;
  try{ await exec(STEPS[idx],true); }catch(e){ showRuntime(e); }
  if(my!==app.token) return false;
  idx++; updatePos(); await runNotes(n); return my===app.token;
}
export async function play(){
  if(app.playing){ app.playing=false; updatePos(); return; }
  if(idx>=STEPS.length) await jumpTo(0);
  app.playing=true; updatePos();
  const my=app.token;
  while(app.playing && my===app.token && idx<STEPS.length){ if(!await stepForward()) break; await wait(150); }
  if(my===app.token){ app.playing=false; updatePos(); }
}
export function showRuntime(e){ const d=document.createElement('div'); d.textContent=e.message; $('#errors').appendChild(d); }
export function updatePos(){
  $('#pos').textContent=`${idx} / ${STEPS.length}`;
  $('#bPlay').innerHTML=app.playing?ic('pause')+' Pausa':ic('play')+' Reproducir';
  const cur=STEPS[idx]; $('#progress').textContent=app.R?'':(cur?`Siguiente: línea ${cur.line}`:'Fin del guion');
  if(!app.R && DOC.kind==='script' && !PICK){ if($('#tnotas').classList.contains('on')) renderNotes(); if($('#tclips').classList.contains('on')) renderClips(); }
}

export function run(){
  const {steps,errors}=parse($('#script').value);
  $('#errors').innerHTML=errors.map(e=>`<div>${e}</div>`).join('');
  STEPS=steps; app.playing=false; jumpTo(0);
  if(DOC.kind==='script'){ $('#pinfo').innerHTML=`Guion · <b>${esc(DOC.name)}</b><br>${steps.length} pasos${errors.length?` · <span style="color:var(--err)">${errors.length} error${errors.length>1?'es':''}</span>`:''}`; autosaveScript(); }
}