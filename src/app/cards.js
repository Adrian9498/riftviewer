// Generado a partir de legacy/app.js (sección "cards").
import { buildOpenRiftIndex, emptyIndex, lookupByCode } from '../data/openrift';
import { norm } from '../data/text';
import { $, API } from './base';
import { rJump } from './replay-render';
import { run } from './script-engine';
import { app } from './state';

/* ================= Datos de cartas ================= */
export let CARDS = [];

export async function loadCards(){
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
export function ready(){ setStatus(`${CARDS.length} cartas de riftcodex · `+(OR.byCode.size?`${OR.byCode.size} de OpenRift como respaldo`:'sin OpenRift (ejecuta npm run catalogo)'), 'ok'); BYCODE=null; if(app.R){ app.R.layoutKey=''; rJump(app.R.i); } else run(); }
export let BYCODE=null;
export function cardByCode(code,name){
  if(!BYCODE){ BYCODE=new Map(); for(const c of CARDS) if(c.code && (!BYCODE.has(c.code) || BYCODE.get(c.code).alt && !c.alt)) BYCODE.set(c.code,c); }
  const base=(code && BYCODE.get(code.toUpperCase())) || orByCode(code) || (name && findCardRaw(name)) || null;
  return withCustom(base, imgKey(code,name), name);
}
export function setStatus(t,c){ const s=$('#status'); s.textContent=t; s.className=c||''; }

/* OpenRift: respaldo para cartas que riftcodex no tiene (public/openrift-catalog.json, se genera con "npm run catalogo") */
export let OR=emptyIndex();
export const orByCode = code => lookupByCode(OR,code);

/* imágenes propias del usuario (IndexedDB) */
export const CUSTOM=new Map();
export const imgKey = (code,name) => code ? 'card:'+code.toUpperCase() : 'card:n:'+norm(name);
export function withCustom(base,key,name){
  const cu=CUSTOM.get(key) || (name && CUSTOM.get('card:n:'+norm(name)));
  return cu ? {...(base||{name,text:'',type:''}), img:cu, custom:true} : base;
}
export const IDB={
  db:null,
  open(){ return this.db||(this.db=new Promise((res,rej)=>{ const r=indexedDB.open('rb_vis',1); r.onupgradeneeded=()=>r.result.createObjectStore('kv'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); })); },
  async tx(mode,fn){ const db=await this.open(); return new Promise((res,rej)=>{ const t=db.transaction('kv',mode); const st=t.objectStore('kv'); const q=fn(st); t.oncomplete=()=>res(q&&q.result); t.onerror=()=>rej(t.error); }); },
  get(k){ return this.tx('readonly',s=>s.get(k)); },
  set(k,v){ return this.tx('readwrite',s=>s.put(v,k)); },
  del(k){ return this.tx('readwrite',s=>s.delete(k)); },
  async entries(){ const db=await this.open(); return new Promise((res,rej)=>{ const out=[]; const c=db.transaction('kv').objectStore('kv').openCursor(); c.onsuccess=()=>{ const cur=c.result; if(cur){ out.push([cur.key,cur.value]); cur.continue(); } else res(out); }; c.onerror=()=>rej(c.error); }); }
};

export const cache = new Map();
export function findCard(name){
  return withCustom(findCardRaw(name), 'card:n:'+norm(name), name);
}
export function findCardRaw(name){
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

export function init() {
  fetch('openrift-catalog.json').then(r=>r.ok?r.json():null).then(cat=>{
    if(!cat) return; OR=buildOpenRiftIndex(cat,norm); cache.clear(); BYCODE=null; if(CARDS.length) ready();
  }).catch(()=>{});
}
