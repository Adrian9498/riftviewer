import { norm } from '../data/text';
import { parse, isSetup } from '../script/parser';
import { decodeReplay } from '../replay/decode';
import { translateLog } from '../replay/translate';
import { parseDeck } from '../replay/deck';
import { buildOpenRiftIndex, lookupByCode, emptyIndex } from '../data/openrift';

const API ='https://api.riftcodex.com';
const $ = s => document.querySelector(s);
const stage = $('#stage');

/* ================= Datos de cartas ================= */
let CARDS = [];

async function loadCards(){
  try{
    const c = JSON.parse(localStorage.getItem('rb_cards2')||'null');
    if(c && Date.now()-c.t < 864e5*3){ CARDS = c.d; return ready(); }
  }catch(e){}
  try{
    const first = await (await fetch(`${API}/cards?size=100&page=1`)).json();
    let items = first.items;
    const rest = await Promise.all(Array.from({length:first.pages-1},(_,i)=>fetch(`${API}/cards?size=100&page=${i+2}`).then(r=>r.json())));
    rest.forEach(p=>items=items.concat(p.items));
    CARDS = items.map(x=>({
      name:x.name, n:norm(x.name), type:x.classification.type, sup:x.classification.supertype,
      img:x.media.image_url, text:x.text.plain||'', e:x.attributes.energy, m:x.attributes.might,
      alt:!!(x.metadata.alternate_art||x.metadata.signature&&x.classification.type==='Legend'||x.metadata.overnumbered||/\((Signature|Metal|Alternate|Overnumbered)/i.test(x.name)),
      tags:(x.tags||[]).map(norm), num:x.collector_number,
      code:(x.riftbound_id||'').split('-').slice(0,2).join('-').toUpperCase()
    }));
    try{ localStorage.removeItem('rb_cards'); localStorage.setItem('rb_cards2',JSON.stringify({t:Date.now(),d:CARDS})); }catch(e){}
    ready();
  }catch(e){
    setStatus('No se pudieron cargar las cartas de la API ('+e.message+'). Se usarán marcadores de texto.','err');
    run();
  }
}
function ready(){ setStatus(`${CARDS.length} cartas de riftcodex · `+(OR.byCode.size?`${OR.byCode.size} de OpenRift como respaldo`:'sin OpenRift (ejecuta npm run catalogo)'), 'ok'); BYCODE=null; if(R){ R.layoutKey=''; rJump(R.i); } else run(); }
let BYCODE=null;
function cardByCode(code,name){
  if(!BYCODE){ BYCODE=new Map(); for(const c of CARDS) if(c.code && (!BYCODE.has(c.code) || BYCODE.get(c.code).alt && !c.alt)) BYCODE.set(c.code,c); }
  const base=(code && BYCODE.get(code.toUpperCase())) || orByCode(code) || (name && findCardRaw(name)) || null;
  return withCustom(base, imgKey(code,name), name);
}
function setStatus(t,c){ const s=$('#status'); s.textContent=t; s.className=c||''; }

/* OpenRift: respaldo para cartas que riftcodex no tiene (public/openrift-catalog.json, se genera con "npm run catalogo") */
let OR=emptyIndex();
fetch('openrift-catalog.json').then(r=>r.ok?r.json():null).then(cat=>{
  if(!cat) return; OR=buildOpenRiftIndex(cat,norm); cache.clear(); BYCODE=null; if(CARDS.length) ready();
}).catch(()=>{});
const orByCode = code => lookupByCode(OR,code);

/* imágenes propias del usuario (IndexedDB) */
const CUSTOM=new Map();
const imgKey = (code,name) => code ? 'card:'+code.toUpperCase() : 'card:n:'+norm(name);
function withCustom(base,key,name){
  const cu=CUSTOM.get(key) || (name && CUSTOM.get('card:n:'+norm(name)));
  return cu ? {...(base||{name,text:'',type:''}), img:cu, custom:true} : base;
}
const IDB={
  db:null,
  open(){ return this.db||(this.db=new Promise((res,rej)=>{ const r=indexedDB.open('rb_vis',1); r.onupgradeneeded=()=>r.result.createObjectStore('kv'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); })); },
  async tx(mode,fn){ const db=await this.open(); return new Promise((res,rej)=>{ const t=db.transaction('kv',mode); const st=t.objectStore('kv'); const q=fn(st); t.oncomplete=()=>res(q&&q.result); t.onerror=()=>rej(t.error); }); },
  get(k){ return this.tx('readonly',s=>s.get(k)); },
  set(k,v){ return this.tx('readwrite',s=>s.put(v,k)); },
  del(k){ return this.tx('readwrite',s=>s.delete(k)); },
  async entries(){ const db=await this.open(); return new Promise((res,rej)=>{ const out=[]; const c=db.transaction('kv').objectStore('kv').openCursor(); c.onsuccess=()=>{ const cur=c.result; if(cur){ out.push([cur.key,cur.value]); cur.continue(); } else res(out); }; c.onerror=()=>rej(c.error); }); }
};

const cache = new Map();
function findCard(name){
  return withCustom(findCardRaw(name), 'card:n:'+norm(name), name);
}
function findCardRaw(name){
  const k = norm(name);
  if(cache.has(k)) return cache.get(k);
  const score = c => {
    let s = 0;
    if(c.n===k) s=100;
    else if(c.n.startsWith(k+' ')) s=80;
    else if(c.n.split(' ').slice(0,k.split(' ').length).join(' ')===k) s=75;
    else if(c.tags.includes(k)) s=60;
    else if(c.n.includes(k)) s=40;
    else return 0;
    if(!c.alt) s+=10;
    return s;
  };
  let best=null, bs=0;
  for(const c of CARDS){ const s=score(c); if(s>bs){bs=s;best=c;} }
  // si riftcodex no tiene el nombre exacto pero OpenRift sí, usar OpenRift
  if(bs<100 && OR.byName.has(k)) best=OR.byName.get(k);
  cache.set(k,best);
  return best;
}

/* ================= Parser ================= */
const DEMO = `# ===== Ejemplo de guion =====
# Edita, pulsa "Cargar guion" (Ctrl+Enter) y luego Reproducir.
jugador j1 "Adrian"
jugador j2 "Rival"
leyenda j1 "Jinx - Loose Cannon"
leyenda j2 "Vi - Piltover Enforcer"
campo A "Star Spring"
campo B "Trapping Grounds"
mano j1 4
mano j2 4
meta 8

turno j1
fase "Inicio"
runas j1 2
roba j1 "Jinx - Rebel"
juega j1 "Prepared Neophyte" a base
texto "Adrian abre con una unidad barata"

turno j2
runas j2 2
roba j2
juega j2 "Undying Legion" a base
mueve j2 "Undying Legion" a A
controla j2 A
puntos j2 +1

turno j1
prepara j1 todo
runas j1 3
juega j1 "Jinx - Rebel" a base
mueve j1 "Jinx - Rebel" a A
mueve j1 "Prepared Neophyte" a A
texto "¡Jinx va a disputar el campo A!"
combate A
daño "Undying Legion" 3
muere "Undying Legion"
daño "Prepared Neophyte" 1
conquista j1 A
puntos j1 +1
agota "Jinx - Rebel"

turno j2
runas j2 4
juega j2 "Vault Breaker"
texto "Hechizo directo al descarte"
juega j2 "Lord Broadmane" a B
controla j2 B
puntos j2 +1
pausa 1
gana j1
`;


/* ================= Estado / render ================= */
let STEPS=[], idx=0, playing=false, speed=1, uid=0, token=0;
let G; // estado del juego
const el = {};          // id -> element
const fieldsEl=$('#fields');

function reset(){
  G={players:{1:{name:'Jugador 1',pts:0,runes:0},2:{name:'Jugador 2',pts:0,runes:0}},cards:{},fields:{},goal:8,turn:0,active:0};
  uid=0;   // ids estables entre reconstrucciones, para que las notas sigan apuntando a la misma carta
  Object.values(el).forEach(e=>e.remove()); for(const k in el) delete el[k];
  fieldsEl.innerHTML=''; $('#log').innerHTML=''; $('#victory').classList.remove('show');
  ['#spot','#caption','#banner'].forEach(s=>$(s).classList.remove('show'));
  updateHud();
}
function zoneEl(owner,zone){
  if(['A','B','C'].includes(zone)){
    const f=G.fields[zone]||makeField(zone);
    return f.querySelector(owner===1?'.s1':'.s2');
  }
  return $(`#P${owner} [data-z="${zone}"]`);
}
function makeField(F){
  const d=document.createElement('div'); d.className='field'; d.dataset.f=F;
  d.innerHTML=`<div class="side s2"></div><div class="mid"><span class="flabel">${F}</span><span class="bfname"></span><span class="owner"></span></div><div class="side s1"></div>`;
  const order=['A','B','C']; const after=[...fieldsEl.children].find(c=>order.indexOf(c.dataset.f)>order.indexOf(F));
  fieldsEl.insertBefore(d,after||null); G.fields[F]=d; d._ctrl=0; return d;
}
function newCard(owner,name,zone,known=true){
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
function paintCard(c){
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
function place(c,zone,anim){
  const e=el[c.id]; const first=e.isConnected? e.getBoundingClientRect():null;
  c.zone=zone; const z=zoneEl(c.owner,zone);
  if(zone==='trash') z.insertBefore(e,z.querySelector('.count')); else z.appendChild(e);
  paintCard(c);
  if(anim && first){
    const last=e.getBoundingClientRect(), sc=scale();
    const dx=(first.left-last.left)/sc, dy=(first.top-last.top)/sc;
    if(dx||dy){
      e.animate([{transform:`translate(${dx}px,${dy}px)${c.ex?' rotate(90deg) scale(.86)':''}`},{transform:c.ex?'rotate(90deg) scale(.86)':'none'}],{duration:550/speed,easing:'cubic-bezier(.3,.7,.3,1)'});
    }
  } else if(anim){
    e.animate([{opacity:0,transform:'scale(1.4)'},{opacity:1,transform:'none'}],{duration:400/speed});
  }
  updateHud();
}
function findInst(name,owner,prefZones){
  let [base,n]=name.split('#'); n=parseInt(n||'1'); const k=norm(base);
  const data=findCard(base);
  let list=Object.values(G.cards).filter(c=>c.known && c.zone!=='gone' && (!owner||c.owner===owner) && (norm(c.name)===k || (data&&c.data===data)));
  if(prefZones){ const p=list.filter(c=>prefZones.includes(c.zone)); if(p.length) list=p; }
  return list[n-1]||list[0];
}
function handCards(o){ return Object.values(G.cards).filter(c=>c.owner===o&&c.zone==='hand'); }
function updateHud(){
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
const wait = ms => new Promise(r=>setTimeout(r,ms/speed));
function log(t,o){ const d=document.createElement('div'); d.innerHTML=t; if(o) d.style.borderLeft=`3px solid var(--p${o})`; const L=$('#log'); L.appendChild(d); while(L.children.length>6) L.firstChild.remove(); }
async function spotlight(c,who,ms=1600){
  const s=$('#spot');
  s.querySelector('.who').textContent=who||''; s.querySelector('.who').style.color=c.owner?`var(--p${c.owner})`:'';
  const img=s.querySelector('img'); img.style.display=c.data?'':'none'; if(c.data) img.src=c.data.img;
  s.querySelector('.txt').textContent=c.data?c.data.text:c.name;
  s.classList.add('show'); await wait(ms); s.classList.remove('show');
}
function floatText(target,text,color){
  const r=target.getBoundingClientRect(), sr=innerRect(), sc=scale();
  const d=document.createElement('div'); d.className='float'; d.textContent=text; d.style.color=color;
  d.style.left=((r.left-sr.left)/sc + r.width/sc/2 - 20)+'px'; d.style.top=((r.top-sr.top)/sc)+'px';
  d.style.animationDuration=(1.1/speed)+'s';
  $('#fx').appendChild(d); setTimeout(()=>d.remove(),1200/speed);
}
async function banner(html,ms=1300){ const b=$('#banner'); b.innerHTML=html; b.classList.add('show'); await wait(ms); b.classList.remove('show'); await wait(250); }
const nm = c => `<b>${c.data?.name||c.name}</b>`;
const pn = o => `<b style="color:var(--p${o})">${G.players[o].name}</b>`;

/* ================= Ejecución de pasos ================= */
async function exec(s,anim){
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
async function jumpTo(i){
  token++; reset();
  idx=0;
  while(idx<STEPS.length && (idx<i || isSetup(STEPS[idx]))){
    try{ await exec(STEPS[idx],false); }catch(e){ showRuntime(e); }
    idx++;
  }
  ['#spot','#caption','#banner'].forEach(s=>$(s).classList.remove('show'));
  if(idx<STEPS.length || !STEPS.some(s=>s.cmd==='gana')) $('#victory').classList.remove('show');
  updatePos();
}
async function stepForward(){
  if(idx>=STEPS.length) return false;
  const my=token, n=idx;
  await runQuiz(n); if(my!==token) return false;
  try{ await exec(STEPS[idx],true); }catch(e){ showRuntime(e); }
  if(my!==token) return false;
  idx++; updatePos(); await runNotes(n); return my===token;
}
async function play(){
  if(playing){ playing=false; updatePos(); return; }
  if(idx>=STEPS.length) await jumpTo(0);
  playing=true; updatePos();
  const my=token;
  while(playing && my===token && idx<STEPS.length){ if(!await stepForward()) break; await wait(150); }
  if(my===token){ playing=false; updatePos(); }
}
function showRuntime(e){ const d=document.createElement('div'); d.textContent=e.message; $('#errors').appendChild(d); }
function updatePos(){
  $('#pos').textContent=`${idx} / ${STEPS.length}`;
  $('#bPlay').textContent=playing?'❚❚ Pausa':'▶ Reproducir';
  const cur=STEPS[idx]; $('#progress').textContent=R?'':(cur?`Siguiente: línea ${cur.line}`:'Fin del guion');
  if(!R && DOC.kind==='script' && !PICK){ if($('#tnotas').classList.contains('on')) renderNotes(); if($('#tclips').classList.contains('on')) renderClips(); }
}

function run(){
  const {steps,errors}=parse($('#script').value);
  $('#errors').innerHTML=errors.map(e=>`<div>${e}</div>`).join('');
  STEPS=steps; playing=false; jumpTo(0);
  if(DOC.kind==='script'){ $('#pinfo').innerHTML=`Guion · <b>${esc(DOC.name)}</b><br>${steps.length} pasos${errors.length?` · <span style="color:var(--err)">${errors.length} error${errors.length>1?'es':''}</span>`:''}`; autosaveScript(); }
}

/* ================= Replays de RiftAtlas ================= */
let R=null;
let PCOL=['#3fa9ff','#ff5a6e','#b57bff','#45d483'];
const BFZ=['battlefieldA','battlefieldB','battlefieldC','battlefieldToken'];
const arr = x => !x ? [] : Array.isArray(x) ? x.filter(c=>c&&c.id) : (x.id ? [x] : []);


const tr = t => translateLog(t, $('#rlang').value);

function loadReplay(json){
  const rp=decodeReplay(json);
  const frames=(rp.frames||[]).filter(f=>f&&f.state&&f.state.players);
  if(!frames.length) throw new Error('El replay no tiene jugadas');
  const last=frames[frames.length-1].state;
  const players=[...last.players].sort((a,b)=>a.seat-b.seat).map((p,i)=>({id:p.id,name:p.name,col:PCOL[i%4],bfCode:p.selectedBattlefieldCardCode,bfName:p.selectedBattlefield}));
  // registro nuevo de cada frame
  let seen=new Set();
  frames.forEach(f=>{
    const logs=(f.state.log||[]).filter(l=>l&&l.id&&!seen.has(l.id)).sort((a,b)=>a.at-b.at);
    seen=new Set((f.state.log||[]).map(l=>l.id));
    f.newLogs=logs;
  });
  const start=Math.max(0,frames.findIndex(f=>f.state.phase==='in_game'));
  R={rp,frames,players,start,i:-1,shown:null,ctrl:{},layoutKey:'',
     view:players.some(p=>p.id===rp.viewerPlayerId)?rp.viewerPlayerId:players[0].id};
  R.render=rRender;
  R.key='rb_proj_'+(rp.replayId||(last.roomCode+':'+last.createdAt));
  loadProj(R.key); analyze();
  document.body.classList.add('replay');
  $('#rview').innerHTML=players.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  $('#rview').value=R.view;
  $('#pinfo').innerHTML=`Replay · sala <b>${esc(last.roomCode||'?')}</b> · ${players.map(p=>`<b style="color:${p.col}">${esc(p.name)}</b>`).join(' vs ')}<br>${frames.length} momentos · ${last.turnNumber||'?'} turnos`;
  buildFrameList();
  playing=false; token++;
  $('#scrub').max=frames.length-1;
  rJump($('#rskip').value==='1'?R.start:0);
}

function buildFrameList(){
  const box=$('#frames'); let html='', lastTurn=null;
  R.frames.forEach((f,i)=>{
    const t=f.state.phase==='in_game'?f.state.turnNumber:0;
    if(t!==lastTurn){ lastTurn=t; const ap=R.players.find(p=>p.id===f.state.activeTurnPlayerId); html+=`<div class="turn">${t?`TURNO ${t}${ap?` · <span style="color:${ap.col}">${ap.name}</span>`:''}`:'PREPARACIÓN'}</div>`; }
    const txt=f.newLogs.length? f.newLogs.map(l=>tr(l.text)).join(' · ') : (f.actionType||'').replace(/_/g,' ');
    const nn=(PROJ.notes[i]||[]).length;
    html+=`<div data-i="${i}"><span class="star${PROJ.marks[i]?' on':''}" data-star="${i}" title="Marcar como clip">${PROJ.marks[i]?'★':'☆'}</span>${i}. ${txt.replace(/</g,'&lt;')}${nn?`<span class="nb" title="Notas">✎${nn}</span>`:''}</div>`;
  });
  box.innerHTML=html;
  if(R.i>=0) rPos();
}
$('#frames').addEventListener('click',e=>{
  const st=e.target.closest('[data-star]'); if(st){ toggleMark(+st.dataset.star); return; }
  const d=e.target.closest('[data-i]'); if(d){ playing=false; rJump(+d.dataset.i); }
});

const hudHTML = p => `<div class="hud"><div class="pname">${esc(p.name)}</div>
      <div class="stats"><div class="stat pts"><b data-k="score">0</b><span>Puntos</span></div><div class="stat"><b data-k="runes">0</b><span>Runas</span></div><div class="stat"><b data-k="hand">0</b><span>Mano</span></div><div class="stat"><b data-k="deck">0</b><span>Mazo</span></div></div>
      <div class="turnmark">SU TURNO</div></div>`;
const ZHTML={legend:'<div class="zone z-legend" data-z="legend"><label>Leyenda</label></div>',
  trash:'<div class="zone z-trash" data-z="trash"><label>Descarte</label><span class="count">0</span></div>'};
function rBuild(){
  const fmt=stage.className, lv=$('#rlay').value, lay=lv==='lanes'?'lanes':(fmt==='h'&&lv==='lat'?'lat':'classic'), key=fmt+'|'+lay+'|'+R.view+'|'+R.players.length;
  if(R.layoutKey===key) return; R.layoutKey=key; stage.dataset.lay=lay;
  const board=$('#rboard'); board.querySelectorAll('.rstrip,.laneb,.lhead,.rhandz').forEach(s=>s.remove());
  R.el=new Map(); $('#rfields').innerHTML=''; $('#rchain').innerHTML=''; $('#minimap').innerHTML=''; $('#minimap').classList.remove('show');
  const W=stage.offsetWidth, H=stage.offsetHeight;
  $('#rfields').style.gap='';
  if(lay==='lanes') return buildLanes(fmt);
  // otras distribuciones: ocupan todo el escenario; la cámara se configura al final
  setClip({x:0,y:0,w:W,h:H},true); R.geo=null;
  const vi=R.players.findIndex(p=>p.id===R.view);
  const order=R.players.map((_,k)=>R.players[(vi+k)%R.players.length]);
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
  const fields=[]; R.players.forEach((p,k)=>{ if(p.bfCode||p.bfName) fields.push({z:BFZ[k],code:p.bfCode,name:p.bfName}); });
  R.fieldDefs=fields;
  fields.forEach((f,k)=>R_addField(f.z,f.code,f.name,'ABCD'[k]));
  // cámara: el área de cada jugador es su franja completa
  R.geo={fmt,lay,VR:{x:0,y:0,w:W,h:H},lanes:new Map()};
  document.querySelectorAll('#rcam .rstrip').forEach(s=>R.geo.lanes.set(s.dataset.p,offIn(s)));
  buildMinimap();
}
function setClip(VR,clip){
  Object.assign($('#rclip').style,{left:VR.x+'px',top:VR.y+'px',width:VR.w+'px',height:VR.h+'px',overflow:clip?'hidden':'visible'});
  const c=$('#rcam'); c.style.transition='none'; c.style.transform=''; R.cam={s:1,tx:0,ty:0};
}

/* ---- Mesa de carriles: cada jugador es un carril; los campos son columnas compartidas ---- */
function buildLanes(fmt){
  const W=stage.offsetWidth, H=stage.offsetHeight, P=R.players, n=P.length, pad=12, gap=10, cam=$('#rcam');
  const fields=[]; P.forEach((p,k)=>{ if(p.bfCode||p.bfName) fields.push({z:BFZ[k],code:p.bfCode,name:p.bfName}); });
  const g={fmt,lay:'lanes',lanes:new Map()}; R.geo=g;
  const strip=(p,o)=>{ const d=document.createElement('section'); d.className='rstrip lane '+o; d.dataset.p=p.id; d.style.setProperty('--pc',p.col);
    d.innerHTML=`<div class="linfo">${hudHTML(p)}<div class="irow">${ZHTML.legend}${ZHTML.trash}</div></div><div class="zone z-base fitwrap" data-z="base"><label>Base</label></div><div class="zone z-hand ghost" data-z="hand"></div>`;
    cam.appendChild(d); return d; };
  const lane=(p,x,y,w,h)=>cam.insertAdjacentHTML('afterbegin',`<div class="laneb" data-p="${p.id}" style="--pc:${p.col};left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
  let handBox;
  if(fmt==='h'){
    const handH=180, VR={x:0,y:0,w:W,h:H-handH}, hh=62, lh=(VR.h-hh-8)/n, infoW=300;
    const rest=W-2*pad-infoW-gap, baseW=Math.round(rest*0.34), fW=rest-baseW-gap;
    g.VR=VR; setClip(VR,true);
    cam.insertAdjacentHTML('beforeend',`<div class="lhead" style="left:${pad+infoW+gap}px;top:0;width:${baseW}px;height:${hh}px">BASE</div>`);
    P.forEach((p,k)=>{ const y=hh+k*lh; lane(p,0,y,VR.w,lh);
      const s=strip(p,'h'); Object.assign(s.style,{left:pad+'px',top:y+'px',width:(infoW+gap+baseW)+'px',height:lh+'px',gridTemplateColumns:`${infoW}px ${baseW}px`,columnGap:gap+'px'});
      s.style.setProperty('--icw',Math.min((infoW-56)/3,(lh-96)/1.4)+'px'); s.style.setProperty('--bcw',Math.min(170,(lh-40)/1.4)+'px');
      g.lanes.set(p.id,{x:pad,y,w:infoW+gap+baseW,h:lh}); });
    const F=$('#rfields'); Object.assign(F.style,{left:(pad+infoW+gap+baseW+gap)+'px',top:'0px',width:fW+'px',height:(hh+n*lh)+'px',flexDirection:'row',gap:gap+'px'});
    F.style.setProperty('--lh',lh+'px'); F.style.setProperty('--hh',hh+'px');
    handBox={x:0,y:H-handH,w:W,h:handH};
    Object.assign($('#rchain').style,{left:(W/2-280)+'px',top:(VR.h-175)+'px',width:'560px',height:'150px'});
  } else {
    const handH=240, VR={x:0,y:0,w:W,h:H-handH}, hdrH=200, baseH=320, colW=(W-2*pad-(n-1)*gap)/n;
    g.VR=VR; setClip(VR,true);
    P.forEach((p,k)=>{ const x=pad+k*(colW+gap); lane(p,x,0,colW,VR.h);
      const s=strip(p,'v'); Object.assign(s.style,{left:x+'px',top:'0px',width:colW+'px',height:(hdrH+baseH)+'px',gridTemplateRows:`${hdrH}px ${baseH-gap}px`,rowGap:gap+'px'});
      s.style.setProperty('--icw',Math.min((colW-56)/3,(hdrH-96)/1.4)+'px'); s.style.setProperty('--bcw',Math.min(170,(baseH-50)/1.4,colW-30)+'px');
      g.lanes.set(p.id,{x,y:0,w:colW,h:hdrH+baseH}); });
    const fy=hdrH+baseH+gap, F=$('#rfields');
    Object.assign(F.style,{left:pad+'px',top:fy+'px',width:(W-2*pad)+'px',height:(VR.h-fy-8)+'px',flexDirection:'column',gap:gap+'px'});
    F.style.setProperty('--colw',colW+'px'); F.style.setProperty('--cgap',gap+'px');
    handBox={x:0,y:H-handH,w:W,h:handH};
    Object.assign($('#rchain').style,{left:(W/2-280)+'px',top:(VR.h-175)+'px',width:'560px',height:'150px'});
  }
  // la mano del jugador elegido va fija abajo, fuera de la cámara; los demás solo muestran el número
  const vp=P.find(p=>p.id===R.view)||P[0], hz=document.createElement('div');
  hz.className='zone z-hand cmp rhandz'; hz.dataset.z='hand'; hz.style.setProperty('--pc',vp.col);
  Object.assign(hz.style,{left:handBox.x+'px',top:handBox.y+'px',width:handBox.w+'px',height:handBox.h+'px'});
  hz.innerHTML=`<label>Mano de ${esc(vp.name)}</label>`; $('#rboard').appendChild(hz);
  cam.querySelector(`.rstrip[data-p="${vp.id}"]`)._hand=hz;
  R.fieldDefs=fields; fields.forEach((f,k)=>R_addField(f.z,f.code,f.name,'ABCD'[k]));
  buildMinimap();
}
function R_addField(z,code,name,label){
  const lanes=stage.dataset.lay==='lanes';
  const d=document.createElement('div'); d.className='rfield'+(lanes?' lanes':''); d.dataset.z=z;
  const c=cardByCode(code,name);
  const ik=imgKey(code,name), safe=(name||'').replace(/"/g,'&quot;');
  d.innerHTML=`<div class="fbg"${c?` style="background-image:url('${c.img}')"`:''}></div>
    <div class="fhead" data-ikey="${ik}" data-iname="${safe}"><span class="flabel">${label}</span><span class="bfname">${esc(c?.name||name||'')}</span>${c?'':'<small class="fhint">clic derecho: poner imagen</small>'}<span class="fown"></span></div><div class="units">`+
    (lanes?R.players:[...R.players].sort((a,b)=>(a.id===R.view)-(b.id===R.view))).map(p=>`<div class="grp cmp" data-p="${p.id}" style="--pc:${p.col}"></div>`).join('')+`</div>`;
  d.querySelector('.fhead')._data=c; d.querySelector('.fhead')._iname=name;
  $('#rfields').appendChild(d); return d;
}

function rCardEl(c,owner){
  let e=R.el.get(c.id);
  if(!e){
    e=document.createElement('div'); e.className='card own'; e.innerHTML='<div class="face"></div>';
    e.style.setProperty('--pc',R.players.find(p=>p.id===owner)?.col||'#888');
    R.el.set(c.id,e); e._new=true;
  }
  const data=cardByCode(c.cardCode,c.name);
  e._data=data; e._card=c; e._owner=owner; e._cid=c.id;
  e.dataset.ikey=imgKey(c.cardCode,c.name); e.dataset.iname=c.name||'';
  return e;
}
function rPaint(e,zone){
  const c=e._card, f=e.querySelector('.face'), pol=$('#rhands').value;
  const back = c.hidden || (zone==='hand' && (pol==='none' || (pol==='view' && e._owner!==R.view)));
  e.classList.toggle('back',!!back);
  e.classList.toggle('exhausted',!!c.exhausted && zone!=='hand' && zone!=='trash');
  if(back){ f.className='face'; f.style.backgroundImage=''; f.textContent=''; }
  else if(e._data){ f.className='face'; f.textContent=''; f.style.backgroundImage=`url("${e._data.img}")`; }
  else { f.className='face ph'; f.style.backgroundImage=''; f.textContent=c.name||'?'; }
}
function compress(box,avail){
  const kids=[...box.children].filter(k=>k.classList.contains('card'));
  kids.forEach(k=>k.style.marginLeft='');
  if(kids.length<2 || box.classList.contains('wrap2')) return;
  const cw=kids[0].offsetWidth, gap=8;
  avail = avail || (box.clientWidth-16);
  const need=kids.length*cw+(kids.length-1)*gap;
  if(need>avail){ const ov=(need-avail)/(kids.length-1)+gap; kids.slice(1).forEach(k=>k.style.marginLeft=(-ov)+'px'); }
}
// zonas que se acomodan en varias filas: achica las cartas hasta que quepan todas
function fitWrap(box){
  box.style.removeProperty('--cw'); box.style.removeProperty('--ch');
  let cw=parseFloat(getComputedStyle(box).getPropertyValue('--cw'))||100;
  for(let k=0;k<12 && box.scrollHeight>box.clientHeight+2 && cw>40;k++){
    cw*=0.88; box.style.setProperty('--cw',cw+'px'); box.style.setProperty('--ch',(cw*1.4)+'px'); }
}
// unidades en un campo: lo más grandes posible según cuántos jugadores y unidades hay
function fitField(fe){
  const units=fe.querySelector('.units'), groups=[...units.children].filter(g=>g.children.length);
  if(!groups.length) return;
  const H=units.clientHeight-16, W=units.clientWidth-40, gap=8;
  const Hg=(H-(groups.length-1)*gap)/groups.length-12;
  // para cada grupo: probar 1 o 2 filas y quedarse con la carta más grande; las agotadas (giradas) ocupan más ancho
  let best=Infinity; const rowsOf=new Map();
  for(const g of groups){
    const ks=[...g.children], n=ks.length, ex=ks.filter(k=>k.classList.contains('exhausted')).length;
    let bw=0, br=1;
    for(const r of [1,2]){ if(r>n) break;
      const cols=Math.ceil(n/r), units=cols+Math.min(ex,cols)*0.45;
      const cw=Math.min((W-(cols-1)*gap)/units, ((Hg-(r-1)*gap)/r)/1.4);
      if(cw>bw+4){ bw=cw; br=r; } }
    best=Math.min(best,bw); rowsOf.set(g,br);
  }
  const cw=Math.min(best,172), ch=cw*1.4;
  groups.forEach(g=>{ g.style.setProperty('--cw',cw+'px'); g.style.setProperty('--ch',ch+'px'); g.classList.toggle('wrap2',rowsOf.get(g)===2); });
}
// carriles: cada celda (jugador × campo) acomoda sus unidades lo más grandes posible, en 1 a 3 filas
function fitCells(fe){
  fe.querySelectorAll('.grp').forEach(g=>{
    const ks=[...g.children]; g.classList.remove('wrap2'); if(!ks.length) return;
    const H=g.clientHeight-14, W=g.clientWidth-14, n=ks.length, ex=ks.filter(k=>k.classList.contains('exhausted')).length, gap=8;
    let bw=0, br=1;
    for(const r of [1,2,3]){ if(r>n) break;
      const cols=Math.ceil(n/r), u=cols+Math.min(ex,cols)*0.45;
      const cw=Math.min((W-(cols-1)*gap)/u, ((H-(r-1)*gap)/r)/1.4);
      if(cw>bw+4){ bw=cw; br=r; } }
    const cw=Math.min(bw,180); g.style.setProperty('--cw',cw+'px'); g.style.setProperty('--ch',(cw*1.4)+'px'); g.classList.toggle('wrap2',br>1);
  });
}

/* ---- Cámara que sigue la acción + minimapa ---- */
function camNow(){ const c=$('#rcam'); return c.offsetWidth ? c.getBoundingClientRect().width/(c.offsetWidth*scale()) : 1; }
function offIn(el){ let x=0,y=0,e=el; while(e && e.id!=='rcam'){ x+=e.offsetLeft; y+=e.offsetTop; e=e.offsetParent; } return {x,y,w:el.offsetWidth,h:el.offsetHeight}; }
function union(rs){ const x=Math.min(...rs.map(r=>r.x)), y=Math.min(...rs.map(r=>r.y)); return {x,y,w:Math.max(...rs.map(r=>r.x+r.w))-x,h:Math.max(...rs.map(r=>r.y+r.h))-y}; }
// agranda un objetivo muy pequeño para que la cámara no se acerque de más y quede contexto alrededor
function padTarget(T){
  const VR=R.geo.VR, w=Math.max(T.w+60,VR.w*0.36), h=Math.max(T.h+60,VR.h*0.32);
  return {x:T.x+T.w/2-w/2,y:T.y+T.h/2-h/2,w,h};
}
// zona de un jugador: sus cartas en la base (o su franja si no hay ninguna)
function laneTarget(pid){
  const s=$(`#rcam .rstrip[data-p="${pid}"]`); if(!s) return R.geo.lanes.get(pid);
  const cards=[...s.querySelectorAll('[data-z=base] .card')].map(offIn);
  return cards.length ? padTarget(union(cards)) : R.geo.lanes.get(pid);
}
function fieldTarget(z){
  const fe=$(`#rfields .rfield[data-z="${z}"]`); if(!fe) return null;
  const cells=[...fe.querySelectorAll('.grp > .card')].map(offIn);
  if(!cells.length) return offIn(fe);
  // el título del campo se incluye salvo en carriles horizontales, donde puede quedar lejos de las celdas
  const T=union(cells), head=offIn(fe.querySelector('.fhead'));
  const y0=(R.geo.lay==='lanes'&&R.geo.fmt==='h')?T.y:Math.min(T.y,head.y); return padTarget({x:T.x,y:y0,w:T.w,h:T.y+T.h-y0});
}
// decide a dónde mirar: undefined = no mover; null = vista completa
function camFocus(f,st,prev,zoneOf,prevZone){
  if(st.phase==='in_game' && prev.activeTurnPlayerId!==st.activeTurnPlayerId) return null;
  const conq=f.newLogs.find(l=>/conquered/.test(l.text));
  if(conq){ const fd=R.fieldDefs.find(x=>x.name&&conq.text.includes(x.name)); if(fd) return fieldTarget(fd.z); }
  let lane;
  for(const [id,z] of zoneOf){ const pz=prevZone.get(id); if(!pz || pz===z) continue;
    if(BFZ.includes(z)) return fieldTarget(z);
    if(BFZ.includes(pz)) return fieldTarget(pz);
    if(z==='base' && ['hand','legend'].includes(pz)) lane=laneTarget(R.el.get(id)?._owner); }
  return lane || undefined;
}
function camTo(T,instant){
  const c=$('#rcam'), g=R.geo, mode=$('#rcamsel').value; if(!g) return;
  let s=1,tx=0,ty=0;
  if(T && mode!=='off'){
    const VR=g.VR, fill=mode==='intensa'?0.94:0.86, maxS=mode==='intensa'?2.4:1.6;
    s=Math.max(1,Math.min(maxS,Math.min(VR.w/T.w,VR.h/T.h)*fill));
    tx=VR.w/2-(T.x+T.w/2)*s; ty=VR.h/2-(T.y+T.h/2)*s;
    tx=Math.min(0,Math.max(VR.w-VR.w*s,tx)); ty=Math.min(0,Math.max(VR.h-VR.h*s,ty));
  }
  if(s<1.03){ s=1; tx=0; ty=0; }
  c.style.transition=instant?'none':`transform ${750/speed}ms cubic-bezier(.45,.05,.2,1)`;
  c.style.transform=s===1?'':`translate(${tx}px,${ty}px) scale(${s})`;
  R.cam={s,tx,ty}; updMinimap();
}
function buildMinimap(){
  const g=R.geo, mm=$('#minimap'); if(!g) return;
  const VR=g.VR, w=g.fmt==='h'?280:230, h=w*VR.h/VR.w;
  let body='';
  R.players.forEach(p=>{ const l=$(`#rcam .laneb[data-p="${p.id}"]`)||$(`#rcam .rstrip[data-p="${p.id}"]`); if(l){ const r=offIn(l); body+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${p.col}" fill-opacity=".28"/>`; } });
  document.querySelectorAll('#rfields .rfield').forEach(fe=>{ const r=offIn(fe); body+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="#ffffff" stroke-opacity=".45" stroke-width="6" rx="10"/>`; });
  mm.innerHTML=`<svg viewBox="0 0 ${VR.w} ${VR.h}" width="${w}" height="${h}">${body}<rect id="mmv" fill="none" stroke="#f2c14e" stroke-width="10" rx="8"/></svg>`;
  Object.assign(mm.style,{right:'16px',top:(VR.h-h-16)+'px'});
}
function updMinimap(){
  const mm=$('#minimap'), v=$('#mmv'), c=R.cam; if(!v||!R.geo) return;
  const VR=R.geo.VR;
  v.setAttribute('x',-c.tx/c.s); v.setAttribute('y',-c.ty/c.s); v.setAttribute('width',VR.w/c.s); v.setAttribute('height',VR.h/c.s);
  mm.classList.toggle('show',c.s>1);
}
const center = r => [r.left+r.width/2, r.top+r.height/2];
const fmtXform = ex => ex?'rotate(90deg) scale(.86)':'none';

async function rRender(i,anim){
  const f=R.frames[i]; if(!f) return;
  rBuild();
  const st=f.state, prev=R.shown, sc=scale();
  const before=new Map(); if(anim) R.el.forEach((e,id)=>{ if(e.isConnected) before.set(id,{r:e.getBoundingClientRect(),ex:e.classList.contains('exhausted')}); });
  const prevZone=R.zoneOf||new Map(); const zoneOf=new Map(); const place=[]; // [el, container, zone]
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
    counts[p.id]={score:b.score||0,runes:`${runes.filter(r=>!r.exhausted).length}/${runes.length}`,hand:arr(b.hand).length,deck:arr(b.deck).length,trash:trash.length};
  }
  // cadena
  for(const ce of arr(st.chainEntries)){
    const card=ce.card||ce; const id=(ce.sourceCardId && !zoneOf.has(ce.sourceCardId))?ce.sourceCardId:card.id;
    const owner=ce.byPlayerId||card.ownerPlayerId;
    const e=rCardEl({...card,id},owner); place.push([e,$('#rchain'),'chain']); zoneOf.set(id,'chain');
  }
  // quitar cartas que ya no se ven
  const keep=new Set(place.map(x=>x[0]));
  R.el.forEach((e,id)=>{ if(!keep.has(e)){
    if(anim && e.isConnected){ const r=e.getBoundingClientRect(), sr=innerRect();
      e.style.position='absolute'; e.style.left=((r.left-sr.left)/sc)+'px'; e.style.top=((r.top-sr.top)/sc)+'px'; e.style.margin='0';
      $('#fx').appendChild(e); e.classList.add('gone'); setTimeout(()=>e.remove(),500/speed); }
    else e.remove();
    R.el.delete(id); } });
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
  // HUD
  for(const pid in counts){ const s=strips[pid], c=counts[pid];
    for(const k of ['score','runes','hand','deck']) s.querySelector(`[data-k=${k}]`).textContent=c[k];
    s.querySelector('.count').textContent=c.trash;
    s.classList.toggle('active',st.activeTurnPlayerId===pid && st.phase==='in_game');
    document.querySelector(`.laneb[data-p="${pid}"]`)?.classList.toggle('active',st.activeTurnPlayerId===pid && st.phase==='in_game'); }
  // control de campos (unidades de un solo jugador)
  document.querySelectorAll('#rfields .rfield').forEach(fe=>{
    const z=fe.dataset.z, who=st.players.filter(p=>arr(p.board?.[z]).length).map(p=>p.id);
    if(who.length===1) R.ctrl[z]=who[0];
    const cp=R.players.find(p=>p.id===R.ctrl[z]);
    fe.classList.toggle('ctrl',!!cp); if(cp) fe.style.setProperty('--pc',cp.col);
    fe.querySelector('.fown').textContent=cp?cp.name:'';
  });
  const ap=R.players.find(p=>p.id===st.activeTurnPlayerId);
  $('#turninfo').textContent=st.phase==='in_game'?`TURNO ${st.turnNumber}${ap?' · '+ap.name.toUpperCase():''}`:'PREPARACIÓN';
  // FLIP
  if(anim){
    const cs=sc*camNow();   // las cartas dentro de la cámara están escaladas además por el zoom
    R.el.forEach((e,id)=>{
      const b=before.get(id), ex=e.classList.contains('exhausted');
      if(!b){ e.animate([{opacity:0,transform:'scale(1.3)'},{opacity:1,transform:fmtXform(ex)}],{duration:400/speed}); return; }
      const [ox,oy]=center(b.r), [nx,ny]=center(e.getBoundingClientRect()), k=e.closest('#rcam')?cs:sc;
      const dx=(ox-nx)/k, dy=(oy-ny)/k;
      if(Math.abs(dx)>1||Math.abs(dy)>1||b.ex!==ex)
        e.animate([{transform:`translate(${dx}px,${dy}px) ${fmtXform(b.ex)}`},{transform:fmtXform(ex)}],{duration:550/speed,easing:'cubic-bezier(.3,.7,.3,1)'});
    });
  }
  // cámara: se acerca a donde pasa la jugada
  if(R.geo){
    if(!anim || !prev) camTo(null,!anim);
    else { const f2=camFocus(f,st,prev,zoneOf,prevZone); if(f2!==undefined) camTo(f2); }
  }
  R.zoneOf=zoneOf;
  const prevI=R.i; R.i=i; R.shown=st; rPos();
  const out=st.gameOutcome?.winnerPlayerIds;
  if(!anim){ $('#victory').classList.toggle('show',!!(out&&out.length&&i===R.frames.length-1)); if(out&&i===R.frames.length-1) rVictory(out); return; }
  $('#victory').classList.remove('show');

  /* ---- efectos ---- */
  const logs=f.newLogs.map(l=>tr(l.text));
  logs.forEach(t=>{ const who=R.players.find(p=>t.startsWith(p.name)); log(t.replace(/</g,'&lt;')); if(who) $('#log').lastChild.style.borderLeft=`3px solid ${who.col}`; });
  let t=450;
  if(prev && st.phase==='in_game' && prev.activeTurnPlayerId!==st.activeTurnPlayerId && ap){
    await banner(`TURNO ${st.turnNumber}<small style="color:${ap.col}">${ap.name.toUpperCase()}</small>`,1100); }
  // carta jugada (de mano/campeón a mesa o cadena)
  const played=[...zoneOf].find(([id,z])=>['hand','legend'].includes(prevZone.get(id)) && ['base','chain',...BFZ].includes(z));
  // inicio de batalla: un campo pasa a tener unidades de dos o más jugadores
  if(prev) for(const z of BFZ){
    const cnt=s2=>s2.players.filter(p=>arr(p.board?.[z]).length).length;
    if(cnt(st)>=2 && cnt(prev)<2){ const fe=$(`#rfields .rfield[data-z=${z}]`), fd=R.fieldDefs.find(x=>x.z===z);
      SFX.play('battle'); if(fe){ fe.classList.remove('clash'); void fe.offsetWidth; fe.classList.add('clash'); }
      await banner(`⚔ ¡BATALLA!<small>${esc((fd?.name||'Campo de batalla').toUpperCase())}</small>`,1000); } }
  const conq=f.newLogs.find(l=>/conquered/.test(l.text));
  let gained=false;
  for(const pl of st.players){ const d=(pl.board?.score||0)-(prev?.players.find(q=>q.id===pl.id)?.board?.score||0);
    if(prev && d){ const s=strips[pl.id]; floatText(s.querySelector('[data-k=score]'),(d>0?'+':'')+d,'#f2c14e'); t=Math.max(t,900); if(d>0) gained=true; } }
  if(gained && !conq) SFX.play('point');   // punto por hold (o cualquier punto sin conquista)
  if(conq){ const fd=R.fieldDefs.find(x=>x.name&&conq.text.includes(x.name)); const fe=fd&&$(`#rfields .rfield[data-z=${fd.z}]`);
    const who=R.players.find(p=>conq.text.startsWith(p.name));
    if(fe){ fe.classList.remove('flash'); void fe.offsetWidth; fe.classList.add('flash'); }
    SFX.play('conquest');
    if(who) await banner(`<span style="color:${who.col}">¡CONQUISTA!</span><small>${who.name.toUpperCase()}${fd?' · '+fd.name.toUpperCase():''}</small>`,1100);
    if(gained) SFX.play('point'); }
  if($('#rcap').value==='1' && logs.length){ const cp=$('#caption'); cp.textContent=logs.join(' · '); cp.classList.add('show'); }
  if(played){ const e=R.el.get(played[0]); if(e&&e._data){ const who=R.players.find(p=>p.id===e._owner);
    e.classList.add('highlight'); await rSpot(e._data,who,1500); e.classList.remove('highlight'); } }
  await wait(t);
  if($('#rcap').value==='1') $('#caption').classList.remove('show');
  if(out&&out.length&&!prev?.gameOutcome){ rVictory(out); $('#victory').classList.add('show'); await wait(2500);
    if($('#rauto').value==='1' && i===R.frames.length-1){ await summarySequence(); } }
}
function rVictory(ids){ $('#victory').querySelector('p').innerHTML=ids.map(id=>{ const p=R.players.find(x=>x.id===id); return p?`<b style="color:${p.col}">${p.name}</b>`:''; }).join(' & '); }
async function rSpot(data,who,ms){
  const s=$('#spot'); s.querySelector('.who').textContent=who?`${who.name} juega`:''; s.querySelector('.who').style.color=who?.col||'';
  const img=s.querySelector('img'); img.style.display=''; img.src=data.img; s.querySelector('.txt').textContent=data.text||'';
  s.classList.add('show'); await wait(ms); s.classList.remove('show');
}
function rPos(){
  $('#pos').textContent=`${R.i} / ${R.frames.length-1}`; $('#scrub').value=R.i;
  $('#bPlay').textContent=playing?'❚❚ Pausa':'▶ Reproducir';
  const box=$('#frames'); box.querySelector('.cur')?.classList.remove('cur');
  const d=box.querySelector(`[data-i="${R.i}"]`); if(d){ d.classList.add('cur'); d.scrollIntoView({block:'nearest'}); }
  if($('#tnotas').classList.contains('on') && !PICK) renderNotes();
}
function rJump(i){
  token++; i=Math.max(0,Math.min(R.frames.length-1,i));
  ['#spot','#caption','#banner'].forEach(s=>$(s).classList.remove('show')); $('#log').innerHTML='';
  document.querySelectorAll('.ov').forEach(o=>o.classList.remove('show')); $('#fx').innerHTML='';
  R.shown=null; R.zoneOf=null; rRender(i,false);
}
async function rStep(){
  if(R.i>=R.frames.length-1) return false;
  const my=token, n=R.i+1;
  await runQuiz(n); if(my!==token) return false;
  await rRender(n,true); if(my!==token) return false;
  await runNotes(n); return my===token;
}
async function rPlay(){
  if(playing){ playing=false; rPos(); return; }
  if(R.i>=R.frames.length-1) rJump($('#rskip').value==='1'?R.start:0);
  playing=true; rPos(); const my=token;
  while(playing && my===token && R.i<R.frames.length-1){ if(!await rStep()) break; await wait(150); }
  if(my===token){ playing=false; rPos(); }
}
/* ================= Documento abierto, inicio, recientes y arrastrar archivos ================= */
let DOC={kind:null,name:''};
function setDoc(kind,name){
  DOC={kind,name}; $('#docname').innerHTML=kind?`${kind==='replay'?'▶ Replay':'✎ Guion'} · <b>${esc(name)}</b>`:'';
  $('#hClose').hidden=!kind; switchTab('jug');
  if(kind) maybeTour();
}
function showHome(){ playing=false; renderRecents(); $('#home').classList.add('show'); }
function hideHome(){ $('#home').classList.remove('show'); fit(); }
function openReplay(json,name,raw){
  try{ loadReplay(json); }catch(err){ toast('No se pudo leer el replay: '+err.message,'err'); return false; }
  setDoc('replay',name); hideHome(); toast(`Replay abierto: ${name}`,'ok');
  saveRecent({id:R.key,kind:'replay',name,sub:R.players.map(p=>p.name).join(' vs '),data:raw||JSON.stringify(json)});
  return true;
}
function openScript(text,name){
  playing=false; token++; R=null; document.body.classList.remove('replay');
  $('#victory').classList.remove('show'); $('#turninfo').textContent=''; document.querySelectorAll('.ov').forEach(o=>o.classList.remove('show'));
  $('#script').value=text; loadProj('rb_proj_script:'+name); setDoc('script',name); hideHome(); run(); renderClips();
  clearTimeout(saveT); saveRecent({id:'script:'+name,kind:'script',name,sub:`${STEPS.length} pasos`,data:text});
}
// guion nuevo: un esqueleto mínimo con instrucciones, en lugar del ejemplo completo
const NEW_SCRIPT=`# 1) Pon los nombres, leyendas y campos de batalla:
jugador j1 "Jugador 1"
jugador j2 "Jugador 2"
# leyenda j1 "Nombre de la leyenda"
# campo A "Nombre del campo de batalla"
mano j1 4
mano j2 4

# 2) Escribe las jugadas (pulsa 📖 Comandos para ver todas):
turno j1
`;
async function readDropped(file){
  const text=await file.text();
  if(/\.txt$/i.test(file.name)) return openScript(text,file.name.replace(/\.txt$/i,''));
  let j; try{ j=JSON.parse(text); }catch(e){ toast('El archivo no es un replay ni un guion válido','err'); return; }
  if(j.format==='riftatlas-replay') return openReplay(j,file.name.replace(/\.json$/i,'').replace(/^riftatlas-replay-/,'Replay '),text);
  if(j.format==='rb-vis-project'){ if(!DOC.kind){ toast('Abre primero la partida de este proyecto','err'); return; } return applyProject(j); }
  toast('No reconozco este archivo. Usa un replay de RiftAtlas (.json) o un guion (.txt).','err');
}
$('#replayIn').onchange=async e=>{ const f=e.target.files[0]; e.target.value=''; if(f) readDropped(f); };
$('#fileIn').onchange=async e=>{ const f=e.target.files[0]; e.target.value=''; if(f) readDropped(f); };
$('#hNew').onclick=()=>{ const d=new Date(); openScript(NEW_SCRIPT,`Guion ${d.toLocaleDateString('es',{day:'numeric',month:'short'})} ${d.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}`); };
$('#hDemo').onclick=()=>openScript(DEMO,'Ejemplo');
$('#hClose').onclick=hideHome;
$('#bHome').onclick=showHome;
let dragN=0;
addEventListener('dragenter',e=>{ if(e.dataTransfer?.types?.includes('Files')){ dragN++; $('#dropov').classList.add('show'); } });
addEventListener('dragleave',()=>{ if(--dragN<=0){ dragN=0; $('#dropov').classList.remove('show'); } });
addEventListener('dragover',e=>{ if(e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
addEventListener('drop',e=>{ dragN=0; $('#dropov').classList.remove('show');
  if(e.defaultPrevented) return;   // soltado sobre una carta: es una imagen para esa carta
  const f=e.dataTransfer?.files?.[0]; if(!f) return; e.preventDefault(); readDropped(f); });

// recientes (en IndexedDB): los últimos replays y guiones, para reabrirlos con un clic
async function saveRecent(item){
  try{ item.ts=Date.now(); await IDB.set('recent:'+item.id,item);
    const old=(await IDB.entries()).filter(([k])=>k.startsWith('recent:')).sort((a,b)=>b[1].ts-a[1].ts).slice(8);
    for(const [k] of old) await IDB.del(k); }catch(e){}
}
const ago=ts=>{ const m=Math.round((Date.now()-ts)/60000); return m<1?'ahora':m<60?`hace ${m} min`:m<1440?`hace ${Math.round(m/60)} h`:`hace ${Math.round(m/1440)} d`; };
async function renderRecents(){
  let list=[]; try{ list=(await IDB.entries()).filter(([k])=>k.startsWith('recent:')).map(([,v])=>v).sort((a,b)=>b.ts-a.ts); }catch(e){}
  $('#hrecent').hidden=!list.length;
  $('#recents').innerHTML=list.map(r=>`<div class="rec-item" data-rid="${esc(r.id)}"><span class="ri">${r.kind==='replay'?'▶':'✎'}</span>
    <span class="rt"><b>${esc(r.name)}</b><small>${r.kind==='replay'?'Replay':'Guion'}${r.sub?' · '+esc(r.sub):''} · ${ago(r.ts)}</small></span>
    <button class="rx" data-rdel="${esc(r.id)}" title="Quitar de recientes">✕</button></div>`).join('');
}
$('#recents').onclick=async e=>{
  const del=e.target.closest('[data-rdel]'); if(del){ await IDB.del('recent:'+del.dataset.rdel).catch(()=>{}); renderRecents(); return; }
  const it=e.target.closest('[data-rid]'); if(!it) return;
  const r=await IDB.get('recent:'+it.dataset.rid).catch(()=>null); if(!r) return;
  if(r.kind==='replay') openReplay(JSON.parse(r.data),r.name,r.data); else openScript(r.data,r.name);
};
// el guion se guarda solo en recientes mientras lo editas
let saveT=null;
function autosaveScript(){ if(DOC.kind!=='script') return; clearTimeout(saveT);
  saveT=setTimeout(()=>saveRecent({id:'script:'+DOC.name,kind:'script',name:DOC.name,sub:`${STEPS.length} pasos`,data:$('#script').value}),600); }

/* pestañas del panel (las mismas en guion y replay) */
function switchTab(t){
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x.dataset.t===t));
  document.querySelectorAll('#editor .tab').forEach(x=>x.classList.toggle('on',x.dataset.t===t));
  if(t==='notas') renderNotes(); if(t==='clips') renderClips();
}
document.querySelector('.tabs').onclick=e=>{ const b=e.target.closest('button'); if(b) switchTab(b.dataset.t); };

/* formato: siempre visible en la barra superior */
function setFmt(f){
  stage.className=f; document.querySelectorAll('#fmtseg button').forEach(b=>b.classList.toggle('on',b.dataset.f===f));
  try{ localStorage.setItem('rb_fmt',f); }catch(e){} fit();
  if(R){ R.layoutKey=''; rJump(R.i); } else jumpTo(idx);
}
$('#fmtseg').onclick=e=>{ const b=e.target.closest('button'); if(b) setFmt(b.dataset.f); };
$('#bCmds').onclick=()=>{ openModal('📖 Comandos del guion',`<div class="full">${$('#cmdHelp').innerHTML}</div>`,[['Cerrar','primary']]); };

/* panel lateral plegable */
function togglePanel(force){
  const off=force!==undefined?!force:!document.body.classList.contains('nopanel');
  document.body.classList.toggle('nopanel',off); $('#bPanel').classList.toggle('on',!off);
  if(off && !togglePanel.told && (togglePanel.told=true)) toast('Panel oculto: el tablero usa toda la ventana. Lleva el mouse arriba para ver la barra, o pulsa P. Con F11 queda a pantalla completa.');
  requestAnimationFrame(()=>{ fit(); if(R){ R.layoutKey=''; rJump(R.i); } });
}
$('#bPanel').onclick=()=>togglePanel();
$('#bPanel').classList.add('on');

/* ayuda: atajos de teclado, recorrido y restablecer opciones */
const KEYS=[['Espacio','Reproducir / pausar'],['← →','Jugada anterior / siguiente'],['Inicio','Volver al principio'],['H','Modo grabación (oculta menús)'],['P','Mostrar u ocultar el panel'],
  ['?','Esta ayuda'],['Ctrl + Enter','Aplicar cambios del guion'],['Shift','Fijar la carta ampliada al pasar el mouse'],['Esc','Detener la grabación'],['Enter','Terminar de elegir cartas para una nota']];
function openHelp(){
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
$('#bHelp').onclick=openHelp;

/* recorrido de bienvenida: 3 pasos, solo la primera vez que se abre una partida */
const TOUR=[
  {sel:'#topbar',t:'Barra superior',d:'Aquí eliges el <b>formato</b> (16:9 o 9:16), la velocidad, los sonidos 🔊 y tu marca 🎨. Con <b>⏺ Exportar</b> sacas el video con plantillas para YouTube, Shorts o clips.'},
  {sel:'#editor .tabs',t:'Panel lateral',d:'<b>Jugadas</b> o <b>Guion</b> para moverte por la partida, <b>Vista</b> para la distribución y la cámara, <b>⭐ Clips</b> para marcar momentos y <b>💬 Notas</b> para flechas, textos y "adivina la jugada".'},
  {sel:'#ctrl',t:'Reproducción',d:'Reproduce, pausa o avanza jugada por jugada. Atajos: <b>Espacio</b> y <b>← →</b>. Pulsa <b>?</b> cuando quieras ver todos los atajos.'}
];
let TK=0;
function startTour(){ togglePanel(true); TK=0; $('#tour').classList.add('show'); tourStep(); }
function endTour(){ $('#tour').classList.remove('show'); try{ localStorage.setItem('rb_tour','1'); }catch(e){} }
function tourStep(){
  const s=TOUR[TK], t=document.querySelector(s.sel); if(!t || !t.offsetParent){ if(++TK<TOUR.length) return tourStep(); return endTour(); }
  const r=t.getBoundingClientRect(), box=$('#tour .tbox'), bub=$('#tour .tbub'), pad=6;
  Object.assign(box.style,{left:(r.left-pad)+'px',top:(r.top-pad)+'px',width:(r.width+pad*2)+'px',height:(r.height+pad*2)+'px'});
  bub.querySelector('.tstep').textContent=`PASO ${TK+1} DE ${TOUR.length}`; bub.querySelector('h3').textContent=s.t; bub.querySelector('p').innerHTML=s.d;
  $('#tNext').textContent=TK===TOUR.length-1?'¡Listo!':'Siguiente';
  const bw=Math.min(340,innerWidth-24), below=r.bottom+16+200<innerHeight;
  const x=Math.max(12,Math.min(innerWidth-bw-12, r.left+r.width/2-bw/2));
  bub.style.left=x+'px'; bub.style.top=(below?r.bottom+16:Math.max(12,r.top-16-bub.offsetHeight))+'px';
}
$('#tNext').onclick=()=>{ if(++TK<TOUR.length) tourStep(); else endTour(); };
$('#tSkip').onclick=endTour;
function maybeTour(){ let seen=false; try{ seen=!!localStorage.getItem('rb_tour'); }catch(e){} if(!seen) setTimeout(startTour,700); }

/* avisos flotantes */
function toast(t,c){ setStatus(t,c); const d=document.createElement('div'); d.className='toast '+(c||''); d.textContent=t; $('#toasts').appendChild(d); setTimeout(()=>d.classList.add('out'),3200); setTimeout(()=>d.remove(),3700); }
$('#rview').onchange=e=>{ R.view=e.target.value; R.layoutKey=''; rJump(R.i); };
try{ $('#rlay').value=localStorage.getItem('rb_lay2')||'lanes'; $('#rcamsel').value=localStorage.getItem('rb_cam')||'suave'; }catch(e){}
$('#rlay').onchange=e=>{ try{ localStorage.setItem('rb_lay2',e.target.value); }catch(err){} if(R){ R.layoutKey=''; rJump(R.i); } };
$('#rcamsel').onchange=e=>{ try{ localStorage.setItem('rb_cam',e.target.value); }catch(err){} if(R) camTo(null,true); };
$('#rhands').onchange=$('#rlang').onchange=()=>{ if($('#rlang').value) buildFrameList(); rJump(R.i); };
$('#scrub').oninput=e=>{ if(R){ playing=false; rJump(+e.target.value); } };

/* ================= Utilidades comunes ================= */
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// espera en tiempo real (no depende de la velocidad) y se corta si cambia la reproducción
async function hold(ms){ const my=token, end=Date.now()+ms; while(Date.now()<end && my===token) await sleep(80); }
function openModal(title,body,buttons){
  const m=$('#modal'); m.querySelector('h2').textContent=title; m.querySelector('.mbody').innerHTML=body;
  const f=m.querySelector('.mfoot'); f.innerHTML='';
  buttons.forEach(([label,cls,fn])=>{ const b=document.createElement('button'); b.className='btn '+(cls||''); b.textContent=label;
    b.onclick=()=>{ if(fn && fn()===false) return; closeModal(); }; f.appendChild(b); });
  m.classList.add('show'); return m.querySelector('.mbody');
}
function closeModal(){ $('#modal').classList.remove('show'); }
$('#modal').addEventListener('mousedown',e=>{ if(e.target.id==='modal') closeModal(); });
function fileToDataURL(file,maxH){
  return new Promise((res,rej)=>{ const img=new Image();
    img.onload=()=>{ const s=Math.min(1,maxH/img.height), c=document.createElement('canvas');
      c.width=Math.round(img.width*s); c.height=Math.round(img.height*s); c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(img.src); res(c.toDataURL(file.type==='image/png'?'image/png':'image/jpeg',0.9)); };
    img.onerror=rej; img.src=URL.createObjectURL(file); });
}
function rerender(){ if(R){ R.layoutKey=''; rJump(R.i); } else jumpTo(idx); }

/* ================= 1. Exportar video ================= */
const REC={on:false,stopped:false,track:null,stop(){ this.stopped=true; token++; playing=false; try{ this.track?.stop(); }catch(e){} }};
$('#bExport').onclick=()=>{
  if(!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder){ alert('Tu navegador no permite grabar video. Usa Chrome o Edge en la PC.'); return; }
  if(!DOC.kind){ toast('Abre primero un replay o un guion','err'); return; }
  playing=false;
  // "inicio" de la partida: en replay, donde empieza el juego (o el principio); en guion, antes del primer paso
  const last=PB.count()-1, start=R?($('#rskip').value==='1'?R.start:0):-1, cur=PB.cur(), nClips=markIds().length;
  const P={
    yt:   {ic:'▶', t:'YouTube', d:'16:9 · 60 fps · partida completa', fmt:'h', fps:60, segs:()=>[{from:start,to:last}]},
    short:{ic:'📱', t:'Short / TikTok / Reels', d:`9:16 · 30 fps · desde la jugada actual${cur>start?` (#${cur})`:''} hasta el final`, fmt:'v', fps:30, segs:()=>[{from:Math.max(start,cur),to:last}]},
    clip: {ic:'✂', t:'Clip de la jugada actual', d:cur>=0?`Jugada #${cur} con ${PROJ.before} antes y ${PROJ.after} después · formato actual`:'Avanza primero a una jugada', fps:60, off:cur<0, segs:()=>[clipSeg(cur)]},
    clips:{ic:'⭐', t:'Todos los clips', d:nClips?`${nClips} clip${nClips>1?'s':''} en un solo video, con su título · formato actual`:'Todavía no marcaste clips (pestaña ⭐ Clips)', fps:60, off:!nClips, segs:()=>markIds().map(clipSeg)},
    custom:{ic:'⚙', t:'Personalizado', d:'Tú eliges formato, rango, título y fotogramas'}
  };
  const body=openModal('⏺ Exportar video',`
    <div class="full presets">${Object.entries(P).map(([k,p])=>`<button class="preset" data-p="${k}" ${p.off?'disabled':''}><span class="pi">${p.ic}</span><span><b>${p.t}</b><small>${esc(p.d)}</small></span></button>`).join('')}</div>
    <div class="full exc" hidden><div class="form">
      <span>Formato</span><select id="exFmt"><option value="h">16:9 horizontal</option><option value="v">9:16 vertical</option></select>
      <span>Desde la jugada</span><input type="number" id="exFrom" min="0" max="${last}" value="${Math.max(0,R?(cur>=last?start:cur):cur+1)}">
      <span>Hasta la jugada</span><input type="number" id="exTo" min="0" max="${last}" value="${last}">
      <span>Fotogramas</span><select id="exFps"><option>60</option><option>30</option></select>
    </div></div>
    <span>Título inicial</span><input type="text" id="exTitle" placeholder="Opcional. Ej: Diana vs Seraphine">
    <div class="full hint">El navegador te pedirá permiso para grabar <b>esta pestaña</b>: elígela y acepta. Se graba solo el tablero (con sonido), en pantalla completa.${R?' Si el video llega al final y "Al terminar" está en resumen, incluye el resumen y los mazos.':''}</div>`,
    [['Cancelar'],['⏺ Grabar','primary',()=>{
      const k=body.querySelector('.preset.on')?.dataset.p; if(!k){ alert('Elige una plantilla.'); return false; }
      let segs, fmt, fps;
      if(k==='custom'){
        const a=+$('#exFrom').value, b=+$('#exTo').value; if(!(b>=a)){ alert('"Hasta" debe ser mayor o igual que "Desde".'); return false; }
        segs=[{from:R?a:a-1,to:b}]; fmt=$('#exFmt').value; fps=+$('#exFps').value;
      } else { segs=P[k].segs(); fmt=P[k].fmt||stage.className; fps=P[k].fps; }
      const title=$('#exTitle').value.trim(); if(title && segs.length===1) segs[0].label=title;
      exportWith(segs,fmt,fps); }]]);
  $('#exFmt').value=stage.className;
  body.onclick=e=>{ const b=e.target.closest('.preset'); if(!b||b.disabled) return;
    body.querySelectorAll('.preset').forEach(x=>x.classList.toggle('on',x===b)); body.querySelector('.exc').hidden=b.dataset.p!=='custom'; };
  body.querySelector('.preset[data-p=yt]').click();
};
// cambia al formato de la plantilla mientras graba y luego vuelve al que tenías
async function exportWith(segs,fmt,fps){
  const prev=stage.className; if(fmt!==prev) setFmt(fmt);
  await recordVideo(segs,fps);
  if(fmt!==prev) setFmt(prev);
}
async function recordVideo(segs,fps=60){
  let stream;
  try{ stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:fps,max:fps}},audio:false,preferCurrentTab:true,selfBrowserSurface:'include',surfaceSwitching:'exclude'}); }
  catch(e){ setStatus('Grabación cancelada','err'); return; }
  const track=stream.getVideoTracks()[0]; REC.track=track;
  try{ if(window.CropTarget && track.cropTo) await track.cropTo(await CropTarget.fromElement(stage)); }catch(e){}
  // el usuario confirma: así también podemos poner pantalla completa
  await new Promise(res=>{ $('#startrec').classList.add('show');
    $('#bGo').onclick=async()=>{ $('#startrec').classList.remove('show'); try{ await document.documentElement.requestFullscreen(); }catch(e){} res(); }; });
  REC.on=true; REC.stopped=false;
  document.body.classList.add('rec','recording'); await sleep(900); fit(); await sleep(500);
  // mezclar el video de la pestaña con los efectos de sonido del visualizador
  const actx=SND.on?SFX.ensure():null, withAudio=!!(actx&&SFX.dest);
  const recStream=new MediaStream([...stream.getVideoTracks(), ...(withAudio?SFX.dest.stream.getAudioTracks():[])]);
  const types=withAudio ? ['video/mp4;codecs=avc1.640028,mp4a.40.2','video/mp4;codecs=avc1,mp4a.40.2','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']
                        : ['video/mp4;codecs=avc1.640028','video/mp4','video/webm;codecs=vp9','video/webm'];
  const mime=types.find(t=>MediaRecorder.isTypeSupported(t))||'';
  const rec=new MediaRecorder(recStream,{mimeType:mime,videoBitsPerSecond:fps>30?16e6:10e6,audioBitsPerSecond:160000}), chunks=[];
  rec.ondataavailable=e=>{ if(e.data.size) chunks.push(e.data); };
  const done=new Promise(r=>rec.onstop=r);
  track.onended=()=>{ if(REC.on) REC.stop(); };
  rec.start(1000);
  for(const s of segs){ if(REC.stopped) break; if(await playSegment(s)===false && !REC.stopped) break; }
  if(!REC.stopped) await sleep(700);
  REC.on=false;
  if(rec.state!=='inactive') rec.stop();
  await done; try{ track.stop(); }catch(e){}
  if(document.fullscreenElement) await document.exitFullscreen().catch(()=>{});
  document.body.classList.remove('recording'); await sleep(300); fit();
  if(!chunks.length){ setStatus('No se grabó nada','err'); return; }
  const type=rec.mimeType||'video/webm', ext=type.includes('mp4')?'mp4':'webm', blob=new Blob(chunks,{type});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`partida-${new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')}.${ext}`; a.click();
  setStatus(`Video exportado: ${a.download} (${(blob.size/1048576).toFixed(1)} MB)`,'ok');
}
/* Reproducción común: la misma interfaz para guiones y replays.
   En un guion, la "jugada actual" es el último paso ejecutado (idx-1). */
const PB={
  count(){ return R ? R.frames.length : STEPS.length; },
  cur(){ return R ? R.i : idx-1; },
  label(i){ if(R) return frameText(i); const s=STEPS[i]; return s ? ($('#script').value.split(/\r?\n/)[s.line-1]||'').trim() : ''; },
  turn(i){ return R ? (R.frames[i]?.state.turnNumber||0) : STEPS.slice(0,i+1).filter(s=>s.cmd==='turno').length; },
  async jump(i){ if(R) rJump(i); else await jumpTo(i+1); },
  step(){ return R ? rStep() : stepForward(); },
  pos(){ if(R) rPos(); else updatePos(); }
};
async function playSegment(s){
  await PB.jump(s.from); const my=token; playing=true; PB.pos(); await sleep(400);
  if(s.label) await banner(`<span style="font-size:56px">${esc(s.label)}</span>`,1800);
  while(playing && my===token && PB.cur()<s.to){ if(!await PB.step()) break; await wait(150); }
  const complete = my===token && PB.cur()>=s.to;
  if(my===token){ playing=false; PB.pos(); await hold(700); }
  return complete;
}

/* ================= 2. Marcadores y clips ================= */
let PROJ={marks:{},notes:{},before:3,after:3}, PROJKEY='';
function loadProj(key){ PROJKEY=key; PROJ={marks:{},notes:{},before:3,after:3}; try{ Object.assign(PROJ,JSON.parse(localStorage.getItem(key)||'{}')); }catch(e){} }
function saveProj(){ try{ localStorage.setItem(PROJKEY,JSON.stringify(PROJ)); }catch(e){ setStatus('No se pudo guardar el proyecto en el navegador','err'); } }
function frameText(i){ const f=R.frames[i]; return f.newLogs.length ? tr(f.newLogs[f.newLogs.length-1].text) : (f.actionType||'').replace(/_/g,' '); }
function toggleMark(i){ if(i<0) return; if(PROJ.marks[i]) delete PROJ.marks[i]; else PROJ.marks[i]={label:PB.label(i).slice(0,60)}; saveProj(); if(R) buildFrameList(); renderClips(); }
function clipSeg(i){ return {from:Math.max(R?0:-1,i-PROJ.before), to:Math.min(PB.count()-1,i+PROJ.after), label:PROJ.marks[i]?.label||''}; }
const markIds = () => Object.keys(PROJ.marks).map(Number).sort((a,b)=>a-b);
function renderClips(){
  if(!DOC.kind) return; const ids=markIds(), cur=PB.cur();
  $('#tclips').innerHTML=`<div class="tpad">
    <div class="hint">${R?'Pulsa ☆ en cualquier jugada de la pestaña <b>Jugadas</b>, o':'Avanza hasta la jugada que quieras (▶| o ◀) y'} usa el botón de abajo para convertirla en clip. Cada clip incluye unas jugadas antes y después, y su nombre aparece como título.</div>
    <div class="row" style="padding:8px 0"><button class="btn" id="cMarkCur" ${cur<0?'disabled':''}>☆ Marcar la jugada actual${cur>=0?` (#${cur})`:''}</button></div>
    <div class="form"><span>Jugadas antes</span><input type="number" id="cBefore" min="0" max="40" value="${PROJ.before}"><span>Jugadas después</span><input type="number" id="cAfter" min="0" max="40" value="${PROJ.after}"></div>
    <h4>${ids.length} clip${ids.length===1?'':'s'}</h4>
    ${ids.map(i=>`<div class="clip"><small>#${i} · T${PB.turn(i)}</small><input type="text" value="${esc(PROJ.marks[i].label)}" data-lbl="${i}"><button class="btn mini" data-cp="${i}" title="Ver clip">▶</button><button class="btn mini" data-cx="${i}" title="Exportar este clip">⏺</button><button class="btn mini" data-cd="${i}" title="Quitar">✕</button></div>`).join('') || '<div class="hint">Todavía no marcaste ninguna jugada.</div>'}
    ${ids.length?`<div class="row" style="padding:10px 0"><button class="btn" id="cPlayAll">▶ Ver todos</button><button class="btn primary" id="cExpAll">⏺ Exportar todos en un video</button></div>`:''}
    <h4>Proyecto</h4><div class="hint">Clips y notas se guardan solos en este navegador. Para respaldarlos o pasarlos a otra PC:</div>
    <div class="row" style="padding:8px 0"><button class="btn" id="pSave">Guardar proyecto (.json)</button><button class="btn" id="pLoad">Abrir proyecto</button></div></div>`;
}
$('#tclips').addEventListener('input',e=>{
  if(e.target.dataset.lbl){ PROJ.marks[e.target.dataset.lbl].label=e.target.value; saveProj(); }
  if(e.target.id==='cBefore') { PROJ.before=Math.max(0,+e.target.value||0); saveProj(); }
  if(e.target.id==='cAfter') { PROJ.after=Math.max(0,+e.target.value||0); saveProj(); }
});
$('#tclips').addEventListener('click',async e=>{
  const b=e.target.closest('button'); if(!b) return; const d=b.dataset;
  if(d.cp){ playing=false; await playSegment(clipSeg(+d.cp)); }
  else if(d.cx) recordVideo([clipSeg(+d.cx)]);
  else if(d.cd){ delete PROJ.marks[d.cd]; saveProj(); if(R) buildFrameList(); renderClips(); }
  else if(b.id==='cMarkCur'){ if(!PROJ.marks[PB.cur()]) toggleMark(PB.cur()); }
  else if(b.id==='cPlayAll'){ playing=false; for(const i of markIds()){ if(!await playSegment(clipSeg(i))) break; } }
  else if(b.id==='cExpAll') recordVideo(markIds().map(clipSeg));
  else if(b.id==='pSave'){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify({format:'rb-vis-project',replay:PROJKEY,proj:PROJ},null,1)],{type:'application/json'})); a.download=`proyecto-${(DOC.name||'partida').replace(/[^\w-]+/g,'_')}.json`; a.click(); }
  else if(b.id==='pLoad') $('#projIn').click();
});
function applyProject(j){
  if(j.replay!==PROJKEY && !confirm('Este proyecto es de otra partida. ¿Cargarlo de todos modos?')) return;
  PROJ=Object.assign({marks:{},notes:{},before:3,after:3},j.proj); saveProj(); if(R) buildFrameList(); renderClips(); renderNotes(); toast('Proyecto cargado','ok');
}
$('#projIn').onchange=async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f||!DOC.kind) return;
  try{ const j=JSON.parse(await f.text()); if(j.format!=='rb-vis-project') throw new Error('no es un proyecto'); applyProject(j); }
  catch(err){ toast('No se pudo abrir el proyecto: '+err.message,'err'); }
};

/* ================= 3. Notas (anotaciones) y 8. Adivina la jugada ================= */
let PICK=null;
const NOTE_TYPES={texto:'💬 Texto',flecha:'➜ Flecha',circulo:'◯ Resaltar',pausa:'⏸ Pausa',grafica:'📈 Gráfica',adivina:'❓ Adivina'};
function refName(ref){
  if(ref.startsWith('f:')){ if(!R) return 'Campo '+ref.slice(2); const fd=R.fieldDefs?.find(x=>x.z===ref.slice(2)); return fd?.name||'campo'; }
  return R ? (R.el.get(ref)?._card?.name||'carta') : (G.cards[ref]?.name||'carta');
}
function noteLabel(n){
  const t=n.text?` "${esc(n.text)}"`:'';
  if(n.type==='flecha') return `➜ ${esc(n.names?.[0])} → ${esc(n.names?.[1])}${t}`;
  if(n.type==='circulo') return `◯ ${esc((n.names||[]).join(', '))}${t}`;
  return `${NOTE_TYPES[n.type]}${t} · ${n.secs}s`;
}
function renderNotes(){
  if(!DOC.kind) return; const i=PB.cur(), list=PROJ.notes[i]||[];
  if(i<0){ $('#tnotas').innerHTML=`<div class="tpad"><div class="hint">Avanza al menos una jugada con <b>▶|</b> para añadirle notas. Las notas aparecen cuando la reproducción llega a esa jugada.</div></div>`; return; }
  $('#tnotas').innerHTML=`<div class="tpad">
    <div class="hint">Las notas aparecen cuando la reproducción llega a esta jugada. Elige la jugada con ◀ ▶${R?' o desde la pestaña Jugadas':''}.</div>
    <h4>Jugada #${i}</h4><div class="hint">${esc(PB.label(i))}</div>
    ${list.map((n,k)=>`<div class="note"><span>${noteLabel(n)}</span><button class="btn mini" data-nd="${k}">✕</button></div>`).join('') || '<div class="hint" style="margin:6px 0">Sin notas en esta jugada.</div>'}
    <h4>Añadir nota</h4>
    <div class="form">
      <span>Tipo</span><select id="nType">${Object.entries({texto:'💬 Texto en pantalla',flecha:'➜ Flecha entre cartas',circulo:'◯ Resaltar cartas',pausa:'⏸ Pausa para explicar',grafica:'📈 Mostrar gráfica de puntos',adivina:'❓ Adivina la jugada (antes de la jugada)'}).filter(([v])=>R||v!=='grafica').map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>
      <span class="nf-text">Texto</span><input type="text" id="nText" class="nf-text" placeholder="Ej: Aquí debió guardar Stupefy">
      <span>Segundos</span><input type="number" id="nSecs" min="1" max="60" value="4">
      <span class="nf-pick">Cartas</span><div class="nf-pick"><button class="btn mini" id="nPick">Elegir en la mesa</button> <small id="nPicked" style="color:var(--muted)"></small></div>
    </div>
    <div class="hint" id="nHelp" style="margin-top:8px"></div>
    <div class="row" style="padding:10px 0"><button class="btn primary" id="nAdd">Añadir nota</button><button class="btn" id="nTest">▶ Probar esta jugada</button></div></div>`;
  NOTEDRAFT={refs:[],names:[]}; updNoteForm();
}
let NOTEDRAFT={refs:[],names:[]};
const NOTE_HELP={
  texto:'Muestra tu comentario en grande sobre el tablero.',
  flecha:'Pulsa "Elegir en la mesa" y haz clic en la carta de origen y luego en la de destino (puede ser una carta o un campo de batalla). El texto es opcional.',
  circulo:'Pulsa "Elegir en la mesa" y haz clic en una o varias cartas; termina con Enter o con "Listo". El texto es opcional.',
  pausa:'Congela la reproducción unos segundos para que puedas explicar con tu voz.',
  grafica:'Muestra la gráfica de puntos de toda la partida durante unos segundos.',
  adivina:'Antes de mostrar esta jugada aparece "¿QUÉ HARÍAS TÚ?" con cuenta regresiva y luego se revela. Pon tu pregunta en el texto (opcional). Ideal para Shorts.'
};
function updNoteForm(){
  const t=$('#nType')?.value; if(!t) return;
  document.querySelectorAll('.nf-pick').forEach(x=>x.style.display=['flecha','circulo'].includes(t)?'':'none');
  document.querySelectorAll('.nf-text').forEach(x=>x.style.display=['pausa','grafica'].includes(t)?'none':'');
  $('#nSecs').value = {adivina:5,grafica:6,pausa:3}[t]||4;
  $('#nHelp').textContent=NOTE_HELP[t];
  $('#nPicked').textContent=NOTEDRAFT.names.join(' → ');
}
$('#tnotas').addEventListener('change',e=>{ if(e.target.id==='nType'){ NOTEDRAFT={refs:[],names:[]}; updNoteForm(); } });
$('#tnotas').addEventListener('click',async e=>{
  const b=e.target.closest('button'); if(!b) return;
  const ci=PB.cur();
  if(b.dataset.nd!==undefined){ PROJ.notes[ci].splice(+b.dataset.nd,1); if(!PROJ.notes[ci].length) delete PROJ.notes[ci]; saveProj(); if(R) buildFrameList(); renderNotes(); }
  else if(b.id==='nPick') startPick($('#nType').value==='flecha'?2:99);
  else if(b.id==='nAdd'){
    const type=$('#nType').value, n={type,text:$('#nText').value.trim(),secs:Math.max(1,+$('#nSecs').value||4)};
    if(type==='texto' && !n.text){ alert('Escribe el texto.'); return; }
    if(type==='flecha' && NOTEDRAFT.refs.length<2){ alert('Elige dos cartas (origen y destino) en la mesa.'); return; }
    if(type==='circulo' && !NOTEDRAFT.refs.length){ alert('Elige al menos una carta en la mesa.'); return; }
    if(['flecha','circulo'].includes(type)){ n.refs=NOTEDRAFT.refs; n.names=NOTEDRAFT.names; }
    (PROJ.notes[ci]=PROJ.notes[ci]||[]).push(n); saveProj(); if(R) buildFrameList(); renderNotes();
  }
  else if(b.id==='nTest'){ playing=false; await PB.jump(ci-1); await sleep(200); playing=true; PB.pos(); await PB.step(); playing=false; PB.pos(); }
  else if(b.id==='nDone') endPick();
});
function startPick(need){
  NOTEDRAFT={refs:[],names:[]}; PICK={need}; document.body.classList.add('picking');
  $('#nPicked').innerHTML=need===2?'Haz clic en la carta de <b>origen</b>…':'Haz clic en las cartas… <button class="btn mini" id="nDone">Listo</button>';
}
function endPick(){ PICK=null; document.body.classList.remove('picking'); updNoteForm(); }
stage.addEventListener('click',e=>{
  if(!PICK) return;
  const c=e.target.closest('.card'), f=e.target.closest('.rfield, .field');
  const ref = c&&c._cid ? c._cid : f ? 'f:'+(f.dataset.z||f.dataset.f) : null; if(!ref) return;
  e.stopPropagation(); NOTEDRAFT.refs.push(ref); NOTEDRAFT.names.push(refName(ref));
  if(NOTEDRAFT.refs.length>=PICK.need) endPick();
  else $('#nPicked').innerHTML=esc(NOTEDRAFT.names.join(' → '))+(PICK.need===2?' → haz clic en el <b>destino</b>…':' <button class="btn mini" id="nDone">Listo</button>');
},true);
document.addEventListener('keydown',e=>{ if(PICK && e.key==='Enter') endPick(); });

function anchorEl(ref){
  if(!R) return ref.startsWith('f:') ? G.fields[ref.slice(2)] : el[ref];
  return ref.startsWith('f:') ? $(`#rfields .rfield[data-z="${ref.slice(2)}"]`) : R.el.get(ref);
}
function relRect(el){ const r=el.getBoundingClientRect(), ir=innerRect(), sc=scale(); return {x:(r.left-ir.left)/sc,y:(r.top-ir.top)/sc,w:r.width/sc,h:r.height/sc}; }
async function runNotes(i){
  const list=PROJ.notes[i]; if(!list||!list.length) return;
  const vis=list.filter(n=>['texto','flecha','circulo'].includes(n.type));
  if(vis.length){
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
    if(n.type==='grafica' && R) await showChart(n.secs);
  }
}
async function runQuiz(i){
  const n=(PROJ.notes[i]||[]).find(x=>x.type==='adivina'); if(!n) return;
  const q=$('#quiz'), c=q.querySelector('.count'); q.querySelector('.q').textContent=n.text||'Piensa la jugada antes de que se revele…';
  q.classList.add('show'); const my=token;
  for(let k=n.secs;k>0 && my===token;k--){ c.textContent=k; c.animate([{transform:'scale(1.4)',opacity:.4},{transform:'scale(1)',opacity:1}],{duration:400}); await hold(1000); }
  if(my===token){ c.textContent='¡VEAMOS!'; await hold(900); }
  q.classList.remove('show');
}

/* ================= 4. Gráfica de puntos ================= */
function analyze(){
  const F=R.frames, byTurn=new Map();
  for(const f of F){ if(f.state.phase!=='in_game') continue; const sc={}; f.state.players.forEach(p=>sc[p.id]=p.board?.score||0); byTurn.set(f.state.turnNumber||0,sc); }
  R.series=[...byTurn].sort((a,b)=>a[0]-b[0]).map(([t,sc])=>({t,sc}));
  const seen=new Set(), logs=[]; F.forEach(f=>f.newLogs.forEach(l=>{ if(!seen.has(l.id)){ seen.add(l.id); logs.push(l); } }));
  const owner=l=> R.players.some(p=>p.id===l.authorPlayerId) ? l.authorPlayerId : R.players.find(p=>(l.text||'').startsWith(p.name+' '))?.id;
  const st={}; R.players.forEach(p=>st[p.id]={plays:0,conq:0,cards:{}}); R.conquests=[];
  for(const l of logs){ const p=owner(l); if(!p) continue; let m;
    if((m=(l.text||'').match(/played (.+?) from hand/i))){ st[p].plays++; st[p].cards[m[1]]=(st[p].cards[m[1]]||0)+1; }
    if((m=(l.text||'').match(/conquered (.+?)(?: and scored|\.$)/))){ st[p].conq++; R.conquests.push({t:l.turnNumber,pid:p,name:m[1]}); } }
  R.stats=st;
  const lf=F[F.length-1]; R.duration=lf.elapsedMs||0;
  R.decks={}; lf.state.players.forEach(p=>R.decks[p.id]=parseDeck(p.deck?.raw||p.decklistRaw||p.submittedDeck?.raw||p.registeredDeck?.raw||''));
}
function chartSVG(w,h){
  const S=R.series; if(!S.length) return '<p>Sin datos de puntos</p>';
  const pad={l:60,r:30,t:60,b:56}, minT=S[0].t, maxT=S[S.length-1].t;
  const maxY=Math.max(8,...S.flatMap(s=>Object.values(s.sc)));
  const X=t=>pad.l+(maxT===minT?0.5:(t-minT)/(maxT-minT))*(w-pad.l-pad.r), Y=v=>h-pad.b-(v/maxY)*(h-pad.t-pad.b);
  let g='';
  for(let v=0; v<=maxY; v+=maxY>12?2:1) g+=`<line x1="${pad.l}" x2="${w-pad.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#ffffff14"/><text x="${pad.l-14}" y="${Y(v)+6}" fill="#8b97b0" font-size="17" text-anchor="end">${v}</text>`;
  const step=Math.ceil(S.length/24);
  S.forEach((s,k)=>{ if(k%step===0||k===S.length-1) g+=`<text x="${X(s.t)}" y="${h-pad.b+28}" fill="#8b97b0" font-size="16" text-anchor="middle">${s.t}</text>`; });
  g+=`<text x="${w/2}" y="${h-4}" fill="#8b97b0" font-size="15" letter-spacing="2" text-anchor="middle">TURNO</text>`;
  let lines='', dots='';
  R.players.forEach(p=>{ const pts=S.map(s=>[X(s.t).toFixed(1),Y(s.sc[p.id]||0).toFixed(1)]);
    lines+=`<path class="ln" pathLength="1" stroke="${p.col}" d="M${pts.map(q=>q.join(',')).join(' L')}"/>`;
    const lp=pts[pts.length-1]; dots+=`<circle cx="${lp[0]}" cy="${lp[1]}" r="9" fill="${p.col}"/>`; });
  R.conquests.forEach(c=>{ const p=R.players.find(x=>x.id===c.pid), s=S.find(x=>x.t===c.t); if(!p||!s) return;
    dots+=`<rect x="-8" y="-8" width="16" height="16" fill="#0b0f17" stroke="${p.col}" stroke-width="3" transform="translate(${X(c.t)},${Y(s.sc[c.pid]||0)}) rotate(45)"/>`; });
  const legend=R.players.map((p,k)=>`<g transform="translate(${pad.l+k*230},14)"><rect width="20" height="20" rx="5" fill="${p.col}"/><text x="30" y="17" fill="#e6ebf5" font-size="20">${esc(p.name)}</text></g>`).join('')
    +`<g transform="translate(${w-pad.r-170},14)"><rect x="4" y="4" width="13" height="13" transform="rotate(45 10 10)" fill="none" stroke="#e6ebf5" stroke-width="2.5"/><text x="30" y="17" fill="#8b97b0" font-size="17">conquista</text></g>`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Inter,sans-serif">${g}${legend}${lines}<g class="dots">${dots}</g></svg>`;
}
function drawChart(box,w,h){ box.innerHTML=chartSVG(w,h); box.classList.remove('draw'); void box.offsetWidth; requestAnimationFrame(()=>box.classList.add('draw')); }
async function showChart(secs){
  const ov=$('#chartov'), v=stage.className==='v';
  drawChart(ov.querySelector('.chartbox'), v?1000:1600, v?900:760); ov.classList.add('show');
  if(secs){ await hold(secs*1000); ov.classList.remove('show'); }
}
$('#bChart').onclick=()=>{ if(!R) return; const ov=$('#chartov'); if(ov.classList.contains('show')) ov.classList.remove('show'); else { $('#sumov').classList.remove('show'); showChart(0); } };

/* ================= 5. Resumen final ================= */
function sumPage1(){
  const lastSt=R.frames[R.frames.length-1].state, out=lastSt.gameOutcome?.winnerPlayerIds||[], v=stage.className==='v';
  const win=R.players.filter(p=>out.includes(p.id));
  const mm=Math.floor(R.duration/60000), ss=String(Math.floor(R.duration/1000)%60).padStart(2,'0');
  const turns=R.series.length?R.series[R.series.length-1].t:0;
  const cards=R.players.map(p=>{
    const b=lastSt.players.find(x=>x.id===p.id)?.board||{}, leg=arr(b.legend)[0], ld=leg&&cardByCode(leg.cardCode,leg.name), s=R.stats[p.id];
    const fav=Object.entries(s.cards).sort((a,b)=>b[1]-a[1])[0], fd=fav&&cardByCode(null,fav[0]);
    return `<div class="sp" style="--pc:${p.col}">${ld?`<img class="leg" src="${ld.img}">`:''}<div><div class="nm">${out.includes(p.id)?'<span class="crown">👑 </span>':''}${esc(p.name)}</div>
      <div class="rowst"><div><b>${b.score||0}</b><span>Puntos</span></div><div><b>${s.conq}</b><span>Conquistas</span></div><div><b>${s.plays}</b><span>Jugadas</span></div></div>
      ${fav?`<div class="fav">${fd?`<img src="${fd.img}">`:''}<span>Carta más jugada<br><b>${esc(fav[0])}</b> ×${fav[1]}</span></div>`:''}</div></div>`; }).join('');
  return `<div class="sum-head"><h3>RESUMEN DE LA PARTIDA</h3>
    <div class="win">${win.length?`Gana ${win.map(p=>`<span style="color:${p.col}">${esc(p.name)}</span>`).join(' &amp; ')}`:''}</div>
    <div class="meta">${turns} turnos · ${mm}:${ss} min · ${R.players.length} jugadores</div></div>
    <div class="sum-players">${cards}</div><div class="sum-chart chartbox"></div>`;
}
function sumPage2(){
  return `<div class="sum-head"><h3>MAZOS</h3></div><div class="decks">${R.players.map(p=>{
    const d=R.decks[p.id]||{}, items=[...(d.Legend||[]).map(x=>({...x,key:1})),...(d.Champion||[]).map(x=>({...x,key:1})),...(d.MainDeck||[])];
    return `<div class="deck" style="--pc:${p.col}"><div class="nm">${esc(p.name)}</div><div class="grid">${items.map(x=>{ const c=cardByCode(x.code,x.name);
      return `<div class="dc${x.key?' key':''}" style="${c?`background-image:url('${c.img}')`:''}" title="${esc(x.name)}">${c?'':esc(x.name)}<b>${x.n}</b></div>`; }).join('') || '<span class="hint">Sin lista de mazo</span>'}</div></div>`; }).join('')}</div>`;
}
function showSummary(page){
  const ov=$('#sumov'), v=stage.className==='v'; $('#chartov').classList.remove('show');
  ov.innerHTML=page===2?sumPage2():sumPage1(); ov.dataset.page=page; ov.classList.add('show');
  const cb=ov.querySelector('.sum-chart'); if(cb) drawChart(cb, v?980:1500, v?560:400);
}
async function summarySequence(){
  const my=token; showSummary(1); await hold(8000); if(my!==token) return;
  showSummary(2); await hold(9000); if(my===token) $('#sumov').classList.remove('show');
}
$('#bSum').onclick=()=>{ if(!R) return; const ov=$('#sumov'), p=ov.classList.contains('show')?+ov.dataset.page:0;
  if(p===0) showSummary(1); else if(p===1) showSummary(2); else ov.classList.remove('show'); };

/* ================= 6. Mi marca ================= */
const BGS={night:'radial-gradient(ellipse at 50% 50%,#1b2a44 0%,#0e1524 55%,#070a11 100%)',purple:'radial-gradient(ellipse at 50% 50%,#3a1f5c 0%,#1a0f2e 55%,#09060f 100%)',
  green:'radial-gradient(ellipse at 50% 50%,#173d33 0%,#0c2019 55%,#050c09 100%)',red:'radial-gradient(ellipse at 50% 50%,#4a1a22 0%,#240c11 55%,#0d0507 100%)',black:'#050608',chroma:'#00b140'};
let BR={name:'',pos:'br',cols:['#3fa9ff','#ff5a6e','#b57bff','#45d483'],bg:'night',scale:100,align:'center'};
const BRIMG={logo:null,bg:null};
function applyBrand(){
  PCOL=[...BR.cols]; BR.cols.forEach((c,k)=>document.documentElement.style.setProperty('--p'+(k+1),c));
  $('#bg').style.background = BR.bg==='img'&&BRIMG.bg ? `center/cover no-repeat url("${BRIMG.bg}")` : (BGS[BR.bg]||BGS.night);
  const b=$('#brand'); b.className=BR.pos; b.innerHTML=(BRIMG.logo?`<img src="${BRIMG.logo}">`:'')+(BR.name?`<span>${esc(BR.name)}</span>`:'');
  const s=BR.scale/100, org={center:'center center',left:'left center',right:'right center',top:'center top',bottom:'center bottom',tl:'left top',tr:'right top',bl:'left bottom',br:'right bottom'};
  const inn=$('#inner'); inn.style.transformOrigin=org[BR.align]||'center center'; inn.style.transform=s<1?`scale(${s})`:''; stage.dataset.is=s;
  try{ localStorage.setItem('rb_brand',JSON.stringify(BR)); }catch(e){}
  if(R){ R.players.forEach((p,k)=>p.col=PCOL[k%4]); buildFrameList(); }
}
let BRTARGET=null;
$('#bBrand').onclick=()=>{
  const body=openModal('🎨 Mi marca',`
    <span>Nombre / canal</span><input type="text" id="brName" value="${esc(BR.name)}" placeholder="Ej: @MiCanal">
    <span>Logo</span><div><button class="btn mini" data-up="logo">Elegir imagen</button> <button class="btn mini" data-rm="logo">Quitar</button></div>
    <span>Posición del logo</span><select id="brPos"><option value="tl">Arriba izquierda</option><option value="tr">Arriba derecha</option><option value="bl">Abajo izquierda</option><option value="br">Abajo derecha</option></select>
    <span>Colores de jugadores</span><div>${BR.cols.map((c,k)=>`<input type="color" data-col="${k}" value="${c}" title="Jugador ${k+1}">`).join(' ')}</div>
    <span>Fondo</span><div><select id="brBg"><option value="night">Azul noche</option><option value="purple">Morado</option><option value="green">Verde bosque</option><option value="red">Rojo</option><option value="black">Negro</option><option value="chroma">Pantalla verde (chroma key)</option><option value="img">Imagen propia</option></select> <button class="btn mini" data-up="bg">Subir imagen</button></div>
    <span>Tamaño del tablero</span><select id="brScale">${[100,95,90,85,80,75,70,65].map(v=>`<option value="${v}">${v}%</option>`).join('')}</select>
    <span>Alinear tablero</span><select id="brAlign"><option value="center">Centro</option><option value="left">Izquierda</option><option value="right">Derecha</option><option value="top">Arriba</option><option value="bottom">Abajo</option><option value="tl">Arriba izquierda</option><option value="tr">Arriba derecha</option><option value="bl">Abajo izquierda</option><option value="br">Abajo derecha</option></select>
    <div class="full hint">Reduce el tablero y pégalo a un lado para dejar espacio libre a tu cámara. Con <b>Pantalla verde</b> puedes recortar el fondo en tu editor.</div>
    <span>Imágenes de cartas</span><div><span id="brImgs">${CUSTOM.size} personalizada${CUSTOM.size===1?'':'s'}</span> <button class="btn mini" id="brImgsX">Borrar todas</button></div>
    <div class="full hint">Para poner o cambiar la imagen de una carta: <b>clic derecho</b> sobre ella en la mesa, o <b>arrastra</b> una imagen encima.</div>`,
    [['Listo','primary']]);
  $('#brPos').value=BR.pos; $('#brBg').value=BR.bg; $('#brScale').value=BR.scale; $('#brAlign').value=BR.align;
  body.oninput=e=>{ const t=e.target;
    if(t.id==='brName') BR.name=t.value; if(t.id==='brPos') BR.pos=t.value; if(t.id==='brBg') BR.bg=t.value;
    if(t.id==='brScale') BR.scale=+t.value; if(t.id==='brAlign') BR.align=t.value; if(t.dataset.col) BR.cols[+t.dataset.col]=t.value;
    applyBrand(); if(t.dataset.col || t.id==='brScale' || t.id==='brAlign') rerender(); };
  body.onclick=async e=>{ const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.up){ BRTARGET=b.dataset.up; $('#brandImgIn').click(); }
    if(b.dataset.rm){ BRIMG[b.dataset.rm]=null; IDB.del('brand:'+b.dataset.rm).catch(()=>{}); applyBrand(); }
    if(b.id==='brImgsX' && confirm('¿Borrar todas las imágenes de cartas que subiste?')){ for(const k of [...CUSTOM.keys()]){ CUSTOM.delete(k); await IDB.del(k).catch(()=>{}); } $('#brImgs').textContent='0 personalizadas'; rerender(); } };
};
$('#brandImgIn').onchange=async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f||!BRTARGET) return;
  try{ const url=await fileToDataURL(f, BRTARGET==='bg'?1080:240); BRIMG[BRTARGET]=url; await IDB.set('brand:'+BRTARGET,url).catch(()=>{});
    if(BRTARGET==='bg'){ BR.bg='img'; const s=$('#brBg'); if(s) s.value='img'; } applyBrand(); }
  catch(err){ setStatus('No se pudo leer la imagen','err'); }
};

/* ================= 7. Imágenes para cartas faltantes ================= */
let IMGTARGET=null;
stage.addEventListener('contextmenu',async e=>{
  if(REC.on) return; const t=e.target.closest('[data-ikey]'); if(!t) return; e.preventDefault();
  const key=t.dataset.ikey, nm=t.dataset.iname||'esta carta';
  // si ya tiene una imagen propia, ofrecer quitarla (vuelve la imagen oficial, si existe)
  if(CUSTOM.has(key) && confirm(`"${nm}" tiene una imagen que subiste tú.\n\nAceptar: quitarla y usar la imagen oficial.\nCancelar: elegir otra imagen.`)){
    CUSTOM.delete(key); await IDB.del(key).catch(()=>{}); setStatus(`Imagen propia de "${nm}" eliminada`,'ok'); rerender(); return; }
  IMGTARGET=key; $('#imgIn').click();
});
$('#imgIn').onchange=async e=>{ const f=e.target.files[0]; e.target.value=''; if(f&&IMGTARGET) await setCustomImage(IMGTARGET,f); };
stage.addEventListener('dragover',e=>{ if(e.target.closest('[data-ikey]')){ e.preventDefault(); e.dataTransfer.dropEffect='copy'; } });
stage.addEventListener('drop',async e=>{ const t=e.target.closest('[data-ikey]'), f=e.dataTransfer.files[0];
  if(!t||!f||!f.type.startsWith('image/')) return; e.preventDefault(); await setCustomImage(t.dataset.ikey,f); });
async function setCustomImage(key,file){
  try{ const url=await fileToDataURL(file,700); CUSTOM.set(key,url); await IDB.set(key,url).catch(()=>{});
    setStatus('Imagen guardada. Se usará siempre para esta carta.','ok'); rerender(); }
  catch(err){ setStatus('No se pudo leer la imagen','err'); }
}

/* ================= Sonidos: batalla, conquista y punto ================= */
let SND={on:true,vol:70,style:'epico',ev:{battle:true,conquest:true,point:true}};
try{ const s=JSON.parse(localStorage.getItem('rb_snd')||'null'); if(s) SND={...SND,...s,ev:{...SND.ev,...s.ev}}; }catch(e){}
const SND_NAMES={battle:'⚔ Inicio de batalla en un campo',conquest:'🏳 Conquista',point:'⭐ Punto ganado (hold o conquista)'};
const SFX={ctx:null,master:null,dest:null,blobs:{},bufs:{},
  ensure(){
    if(!this.ctx){ const C=window.AudioContext||window.webkitAudioContext; if(!C) return null;
      this.ctx=new C(); this.master=this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.dest=this.ctx.createMediaStreamDestination(); this.master.connect(this.dest); this.setVol();
      for(const k in this.blobs) this.decode(k); }
    if(this.ctx.state==='suspended') this.ctx.resume().catch(()=>{});
    return this.ctx;
  },
  setVol(){ if(this.master) this.master.gain.value=SND.on?SND.vol/100:0; },
  async decode(k){ try{ this.bufs[k]=await this.ctx.decodeAudioData(await this.blobs[k].arrayBuffer()); }catch(e){ delete this.bufs[k]; setStatus('No se pudo leer el audio de '+SND_NAMES[k],'err'); } },
  play(kind,force){
    if(!force && (!SND.on || !SND.ev[kind])) return; const ctx=this.ensure(); if(!ctx) return;
    if(this.bufs[kind]){ const s=ctx.createBufferSource(); s.buffer=this.bufs[kind]; s.connect(this.master); s.start(); return; }
    (SND.style==='clasico'?SYN:SYN_EPIC)[kind](ctx,this.master,ctx.currentTime+0.02);
  }
};
// el navegador solo deja sonar audio después de un clic o tecla del usuario
['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,()=>{ if(SFX.ctx||SND.on) SFX.ensure(); },true));
function tone(ctx,out,{type='sine',f,t,dur,vol=.3,att=.01,f2,cut}){
  const o=ctx.createOscillator(), g=ctx.createGain(); o.type=type; o.frequency.setValueAtTime(f,t);
  if(f2) o.frequency.exponentialRampToValueAtTime(f2,t+dur);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+att); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  let n=o; if(cut){ const fl=ctx.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=cut; o.connect(fl); n=fl; }
  n.connect(g).connect(out); o.start(t); o.stop(t+dur+0.05);
}
function noise(ctx,out,{t,dur,vol=.4,type='bandpass',freq=2000,q=.8}){
  const len=Math.ceil(ctx.sampleRate*dur), b=ctx.createBuffer(1,len,ctx.sampleRate), d=b.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
  const s=ctx.createBufferSource(), fl=ctx.createBiquadFilter(), g=ctx.createGain(); s.buffer=b; fl.type=type; fl.frequency.value=freq; fl.Q.value=q;
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); s.connect(fl).connect(g).connect(out); s.start(t);
}
const SYN={
  // dos golpes de tambor grave con choque metálico
  battle(ctx,out,t){
    for(const [dt,v] of [[0,1],[0.2,.75]]){
      tone(ctx,out,{f:150,f2:42,t:t+dt,dur:.5,vol:.6*v,att:.005});
      noise(ctx,out,{t:t+dt,dur:.28,vol:.4*v,freq:2600,q:.7});
      tone(ctx,out,{type:'square',f:523,t:t+dt,dur:.22,vol:.07*v,att:.002,cut:3500});
      tone(ctx,out,{type:'square',f:787,t:t+dt,dur:.18,vol:.05*v,att:.002,cut:4000}); }
  },
  // fanfarria: arpegio ascendente y acorde final
  conquest(ctx,out,t){
    [392,523.25,659.25].forEach((f,k)=>tone(ctx,out,{type:'sawtooth',f,t:t+k*.11,dur:.22,vol:.16,att:.015,cut:2400}));
    [523.25,659.25,783.99,1046.5].forEach(f=>tone(ctx,out,{type:'sawtooth',f,t:t+.34,dur:1.1,vol:.11,att:.03,cut:2600}));
    tone(ctx,out,{f:130.8,t:t+.34,dur:1.1,vol:.35,att:.02});
    noise(ctx,out,{t:t+.34,dur:.5,vol:.18,type:'highpass',freq:6000,q:.5});
  },
  // campanita brillante, tipo moneda
  point(ctx,out,t){
    tone(ctx,out,{f:1318.5,t,dur:.35,vol:.22,att:.004});
    tone(ctx,out,{f:1760,t:t+.09,dur:.7,vol:.25,att:.004});
    tone(ctx,out,{type:'triangle',f:3520,t:t+.09,dur:.4,vol:.05,att:.004});
  }
};
// estilo épico, inspirado en los juegos de batalla en línea: cuernos, tambores de guerra, impactos y monedas
function swell(ctx,out,{f,t,dur,vol,from=300,to=2400,type='sawtooth'}){
  const o=ctx.createOscillator(), fl=ctx.createBiquadFilter(), g=ctx.createGain();
  o.type=type; o.frequency.value=f; fl.type='lowpass'; fl.frequency.setValueAtTime(from,t); fl.frequency.exponentialRampToValueAtTime(to,t+dur*0.6);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+dur*0.35); g.gain.setValueAtTime(vol,t+dur*0.7); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(fl).connect(g).connect(out); o.start(t); o.stop(t+dur+0.05);
}
function drum(ctx,out,t,v=1){
  tone(ctx,out,{f:110,f2:38,t,dur:.45,vol:.55*v,att:.004});
  noise(ctx,out,{t,dur:.12,vol:.25*v,type:'lowpass',freq:900,q:.7});
}
const SYN_EPIC={
  // cuerno de guerra grave con tambores y un "whoosh" que sube
  battle(ctx,out,t){
    noise(ctx,out,{t,dur:.55,vol:.12,type:'bandpass',freq:700,q:.6});
    [[0,1],[.16,.7],[.32,1]].forEach(([dt,v])=>drum(ctx,out,t+dt,v));
    for(const [f,v] of [[98,.14],[147,.10],[196,.06]]) swell(ctx,out,{f,t:t+.3,dur:1.3,vol:v,from:250,to:1800});
    swell(ctx,out,{f:98.5,t:t+.3,dur:1.3,vol:.08,from:250,to:1600});
  },
  // impacto profundo (como derribar una torre) y acorde heroico de metales
  conquest(ctx,out,t){
    tone(ctx,out,{f:70,f2:28,t,dur:.9,vol:.6,att:.003});
    noise(ctx,out,{t,dur:.7,vol:.3,type:'lowpass',freq:500,q:.5});
    noise(ctx,out,{t,dur:.25,vol:.16,type:'bandpass',freq:2200,q:.8});
    const c=t+.22;
    for(const [f,v] of [[261.6,.11],[329.6,.08],[392,.08],[523.3,.07],[130.8,.12]]) swell(ctx,out,{f,t:c,dur:1.6,vol:v,from:400,to:3200});
    [1568,2093,2637,3136].forEach((f,k)=>tone(ctx,out,{type:'triangle',f,t:c+.25+k*.06,dur:.9,vol:.03,att:.005}));
  },
  // monedas de oro: tintineo metálico rápido con brillo
  point(ctx,out,t){
    [[2637,0],[3136,.05],[3951,.1],[3136,.16],[3951,.21]].forEach(([f,dt],k)=>{
      tone(ctx,out,{type:'triangle',f,t:t+dt,dur:.5-k*.04,vol:.14,att:.002});
      tone(ctx,out,{f:f*2.76,t:t+dt,dur:.18,vol:.03,att:.002}); });
    noise(ctx,out,{t,dur:.35,vol:.06,type:'highpass',freq:7000,q:.5});
  }
};
function saveSnd(){ try{ localStorage.setItem('rb_snd',JSON.stringify(SND)); }catch(e){} SFX.setVol(); }
let SNDTARGET=null;
function openSounds(){
  const body=openModal('🔊 Sonidos',`
    <span>Sonidos</span><select id="sOn"><option value="1">Activados</option><option value="0">Desactivados</option></select>
    <span>Volumen</span><input type="range" id="sVol" min="0" max="100" value="${SND.vol}">
    <span>Estilo</span><select id="sStyle"><option value="epico">Épico (cuernos, tambores, monedas)</option><option value="clasico">Clásico (suave)</option></select>
    ${Object.keys(SND_NAMES).map(k=>`<span><label><input type="checkbox" data-ev="${k}" ${SND.ev[k]?'checked':''}> ${SND_NAMES[k]}</label></span>
      <div><button class="btn mini" data-test="${k}">▶ Probar</button> <button class="btn mini" data-up="${k}">Usar mi audio</button>${SFX.blobs[k]?` <button class="btn mini" data-rm="${k}">Quitar el mío</button> <small style="color:var(--ok)">● propio</small>`:''}</div>`).join('')}
    <div class="full hint">Los sonidos también quedan grabados al <b>exportar video</b>. Puedes reemplazar cualquiera por un audio tuyo (MP3, WAV, OGG); se guarda en este navegador.</div>`,
    [['Listo','primary']]);
  $('#sOn').value=SND.on?'1':'0'; $('#sStyle').value=SND.style||'epico';
  body.oninput=e=>{ const t=e.target;
    if(t.id==='sOn') SND.on=t.value==='1'; if(t.id==='sStyle') SND.style=t.value; if(t.id==='sVol') SND.vol=+t.value; if(t.dataset.ev) SND.ev[t.dataset.ev]=t.checked; saveSnd(); };
  body.onclick=async e=>{ const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.test) SFX.play(b.dataset.test,true);
    if(b.dataset.up){ SNDTARGET=b.dataset.up; $('#sndIn').click(); }
    if(b.dataset.rm){ delete SFX.blobs[b.dataset.rm]; delete SFX.bufs[b.dataset.rm]; await IDB.del('snd:'+b.dataset.rm).catch(()=>{}); openSounds(); } };
}
$('#bSnd').onclick=()=>{ SFX.ensure(); openSounds(); };
$('#sndIn').onchange=async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f||!SNDTARGET) return;
  if(f.size>3*1048576){ alert('El audio es muy pesado (máximo 3 MB). Usa un clip corto.'); return; }
  SFX.blobs[SNDTARGET]=f; await IDB.set('snd:'+SNDTARGET,f).catch(()=>{}); SFX.ensure(); await SFX.decode(SNDTARGET);
  SFX.play(SNDTARGET,true); openSounds();
};

/* ================= Vista ampliada al pasar el mouse (no aparece al grabar) ================= */
const HP={el:null,timer:null,target:null,pinned:false,x:0,y:0};
HP.el=document.createElement('div'); HP.el.id='hoverprev'; document.body.appendChild(HP.el);
function hpHide(){ clearTimeout(HP.timer); HP.target=null; if(!HP.pinned) HP.el.classList.remove('show'); }
function hpPlace(){
  const r=HP.el.getBoundingClientRect(), pad=18;
  let x=HP.x+pad, y=HP.y-r.height/2;
  if(x+r.width>innerWidth-8) x=HP.x-pad-r.width;
  y=Math.max(8,Math.min(innerHeight-r.height-8,y));
  HP.el.style.left=x+'px'; HP.el.style.top=y+'px';
}
function hpShow(t){
  const d=t._data, name=d?.name||t._iname||t._card?.name||'Carta';
  const land=t.classList.contains('fhead') || d?.type==='Battlefield' || d?.type==='battlefield';
  HP.el.className='show'+(land?' land':'');
  HP.el.innerHTML=(d?.img?`<img src="${d.img}" alt="">`:`<div class="noimg">Sin imagen<br><small>clic derecho para poner una</small></div>`)
    +`<div class="hn">${esc(name)}</div>${d?.text?`<div class="ht">${esc(d.text)}</div>`:''}<div class="hk">Mantén <b>Shift</b> para fijarla</div>`;
  const img=HP.el.querySelector('img'); if(img) img.onload=hpPlace;
  hpPlace();
}
stage.addEventListener('mouseover',e=>{
  if(document.body.classList.contains('rec') || REC.on || PICK || HP.pinned) return;
  const t=e.target.closest('.card, .rfield .fhead'); if(!t || t===HP.target) return;
  if(t.classList.contains('back') || t.closest('#fx')) return;
  HP.target=t; clearTimeout(HP.timer); HP.timer=setTimeout(()=>{ if(HP.target===t) hpShow(t); },300);
});
stage.addEventListener('mouseout',e=>{ const t=e.target.closest('.card, .rfield .fhead'); if(t && !t.contains(e.relatedTarget)) hpHide(); });
stage.addEventListener('mousemove',e=>{ HP.x=e.clientX; HP.y=e.clientY; if(HP.el.classList.contains('show') && !HP.pinned) hpPlace(); });
document.addEventListener('keydown',e=>{ if(e.key==='Shift' && HP.el.classList.contains('show')){ HP.pinned=true; HP.el.classList.add('pinned'); } });
document.addEventListener('keyup',e=>{ if(e.key==='Shift'){ HP.pinned=false; HP.el.classList.remove('pinned'); if(!HP.target) HP.el.classList.remove('show'); } });

/* ================= Escala del escenario ================= */
function scale(){ return parseFloat(stage.dataset.s||'1') * parseFloat(stage.dataset.is||'1'); }
function fit(){
  const vp=$('#viewport'), w=stage.offsetWidth, h=stage.offsetHeight;
  const s=Math.min(vp.clientWidth/w, vp.clientHeight/h);
  stage.dataset.s=s; stage.style.transform=`translate(-50%,-50%) scale(${s})`;
}
const innerRect = () => $('#inner').getBoundingClientRect();
addEventListener('resize',fit);

/* ================= UI ================= */
$('#bLoad').onclick=run;
$('#bPlay').onclick=()=> R ? rPlay() : play();
$('#bNext').onclick=async()=>{ playing=false; if(R) await rStep(); else await stepForward(); };
$('#bPrev').onclick=()=>{ playing=false; if(R) rJump(R.i-1); else jumpTo(Math.max(0,idx-1)); };
$('#bStart').onclick=()=>{ playing=false; if(R) rJump($('#rskip').value==='1'?R.start:0); else jumpTo(0); };
$('#speed').onchange=e=>speed=parseFloat(e.target.value);
$('#bRec').onclick=()=>{ document.body.classList.toggle('rec'); fit(); };
$('#bSave').onclick=()=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([$('#script').value],{type:'text/plain'})); a.download=`${(DOC.name||'partida').replace(/[\\/:*?"<>|]+/g,'_')}.txt`; a.click(); };
$('#script').addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.ctrlKey){ e.preventDefault(); run(); } });
$('#script').addEventListener('input',autosaveScript);
document.addEventListener('keydown',e=>{
  if(['TEXTAREA','INPUT','SELECT'].includes(document.activeElement.tagName)) return;
  if($('#home').classList.contains('show') || $('#modal').classList.contains('show') || $('#tour').classList.contains('show')) return;
  if(e.key==='?'){ openHelp(); return; }
  if(e.key.toLowerCase()==='p' && !e.ctrlKey && !e.metaKey){ togglePanel(); return; }
  if(e.key==='Escape' && REC.on){ REC.stop(); return; }
  if(e.code==='Space'){ e.preventDefault(); $('#bPlay').click(); }
  else if(e.key==='ArrowRight') $('#bNext').click();
  else if(e.key==='ArrowLeft') $('#bPrev').click();
  else if(e.key==='Home') $('#bStart').click();
  else if(e.key.toLowerCase()==='h') $('#bRec').click();
});
// buscador
$('#q').addEventListener('input',e=>{
  const k=norm(e.target.value), R=$('#results');
  if(k.length<2){ R.style.display='none'; return; }
  const seen=new Set(), res=[];
  for(const c of CARDS){ if(c.n.includes(k) && !seen.has(c.name) && !c.alt){ seen.add(c.name); res.push(c); if(res.length>=30) break; } }
  R.innerHTML=res.map(c=>`<div data-n="${c.name.replace(/"/g,'&quot;')}"><img src="${c.img}" loading="lazy"><span>${c.name}<br><small>${c.type}${c.sup?' · '+c.sup:''}${c.e!=null?' · '+c.e+'⚡':''}${c.m!=null?' · '+c.m+'⚔':''}</small></span></div>`).join('')||'<div><small>Sin resultados</small></div>';
  R.style.display='block';
});
$('#results').addEventListener('mousedown',e=>{
  const d=e.target.closest('[data-n]'); if(!d) return; e.preventDefault();
  const ta=$('#script'), ins=`"${d.dataset.n}"`, p=ta.selectionStart;
  ta.value=ta.value.slice(0,p)+ins+ta.value.slice(ta.selectionEnd); ta.focus(); ta.selectionStart=ta.selectionEnd=p+ins.length;
  $('#results').style.display='none'; $('#q').value='';
});
$('#q').addEventListener('blur',()=>setTimeout(()=>$('#results').style.display='none',150));

try{ Object.assign(BR,JSON.parse(localStorage.getItem('rb_brand')||'{}')); }catch(e){}
try{ const f=localStorage.getItem('rb_fmt'); if(f==='v'||f==='h'){ stage.className=f; document.querySelectorAll('#fmtseg button').forEach(b=>b.classList.toggle('on',b.dataset.f===f)); } }catch(e){}
applyBrand(); fit(); reset(); loadCards();
// el guion que quedó guardado en versiones anteriores pasa a "Recientes"
try{ const old=localStorage.getItem('rb_script'); if(old && old.trim() && old!==DEMO){
  saveRecent({id:'script:Guion anterior',kind:'script',name:'Guion anterior',sub:'guardado antes',data:old}).then(renderRecents); }
  localStorage.removeItem('rb_script'); }catch(e){}
renderRecents();
// imágenes guardadas (cartas propias, logo y fondo)
IDB.entries().then(list=>{
  for(const [k,v] of list){ if(k.startsWith('card:')) CUSTOM.set(k,v); else if(k==='brand:logo') BRIMG.logo=v; else if(k==='brand:bg') BRIMG.bg=v;
    else if(k.startsWith('snd:')){ SFX.blobs[k.slice(4)]=v; if(SFX.ctx) SFX.decode(k.slice(4)); } }
  applyBrand(); if(CUSTOM.size && CARDS.length) rerender();
}).catch(()=>{});
