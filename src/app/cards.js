// Generado a partir de legacy/app.js (sección "cards").
import { buildOpenRiftIndex, emptyIndex, lookupByCode, openRiftExtraCards } from '../data/openrift';
import { norm } from '../data/text';
import { $, API, pub } from './base';
import { rJump } from './replay-render';
import { run } from './script-engine';
import { app } from './state';

/* ================= Datos de cartas ================= */
export let CARDS = [];

/** ¿Ya terminó (bien o mal) la carga de riftcodex? Hasta entonces OpenRift no arma el catálogo solo. */
let API_DONE=false;
/** GET con límite de tiempo: si riftcodex se queda colgado no deja la app sin cartas. */
function getJSON(url,ms=15000){
  const ac=new AbortController(), t=setTimeout(()=>ac.abort(),ms);
  return fetch(url,{signal:ac.signal}).then(r=>{ if(r.ok===false) throw new Error('HTTP '+r.status); return r.json(); }).finally(()=>clearTimeout(t));
}
export async function loadCards(){
  // la copia guardada se usa de inmediato aunque sea vieja; si ya pasaron 3 días se actualiza por detrás
  let c=null; try{ c=JSON.parse(localStorage.getItem('rb_cards4')||'null'); }catch(e){}
  if(c?.d?.length){ CARDS=c.d; API_DONE=true; ready(); if(Date.now()-c.t < 864e5*3) return; }
  try{
    const first = await getJSON(`${API}/cards?size=100&page=1`);
    let items = first.items;
    const rest = await Promise.all(Array.from({length:first.pages-1},(_,i)=>getJSON(`${API}/cards?size=100&page=${i+2}`)));
    rest.forEach(p=>items=items.concat(p.items));
    CARDS = items.map(x=>({
      name:x.name, n:norm(x.name), type:x.classification.type, sup:x.classification.supertype,
      img:x.media.image_url, text:x.text.plain||'', rich:x.text.rich||'', e:x.attributes.energy, m:x.attributes.might, pw:x.attributes.power,
      dom:(x.classification.domain||[]).filter(d=>d!=='Colorless'), rar:x.classification.rarity||'', set:x.set?.set_id||'',
      alt:!!(x.metadata.alternate_art||x.metadata.signature&&x.classification.type==='Legend'||x.metadata.overnumbered||/\((Signature|Metal|Alternate|Overnumbered)/i.test(x.name)),
      tags:(x.tags||[]).map(norm), num:x.collector_number,
      code:(x.riftbound_id||'').split('-').slice(0,2).join('-').toUpperCase()
    }));
    try{ localStorage.removeItem('rb_cards'); localStorage.removeItem('rb_cards2'); localStorage.removeItem('rb_cards3'); localStorage.setItem('rb_cards4',JSON.stringify({t:Date.now(),d:CARDS})); }catch(e){}
    API_DONE=true; ready();
  }catch(e){
    console.warn('riftcodex no respondió', e);
    API_DONE=true;
    if(c?.d?.length) return;   // se queda la copia guardada
    // sin riftcodex ni copia: el catálogo sale completo de OpenRift
    CARDS=[]; ready();
  }
}
export function ready(){ mergeOpenRift(); const rc=CARDS.filter(c=>c.src!=='openrift').length; setStatus((rc?`${rc} cartas de riftcodex · `:`riftcodex no responde · `)+(OR.byCode.size?`${OR.byCode.size} de OpenRift como respaldo`:'sin OpenRift (ejecuta npm run catalogo)'), 'ok'); BYCODE=null; CATALOG=null; document.dispatchEvent(new Event('rb:cards')); if(app.R){ app.R.layoutKey=''; rJump(app.R.i); } else run(); }
export let BYCODE=null;
export function cardByCode(code,name,imageUrl){
  if(!code && (imageUrl || isToken(name))) return withCustom(tokenCard(name,imageUrl), imgKey(code,name), name);
  if(!BYCODE){ BYCODE=new Map(); for(const c of CARDS) if(c.code && (!BYCODE.has(c.code) || BYCODE.get(c.code).alt && !c.alt)) BYCODE.set(c.code,c); }
  const base=(code && BYCODE.get(code.toUpperCase())) || orByCode(code) || (name && findCardRaw(name)) || null;
  return withCustom(base, imgKey(code,name), name);
}

/* tokens: no traen código de carta. Los replays del simulador dan su propia imagen ("/tokens/SandSoldier.webp");
   en los guiones se usa la de OpenRift o, si no la tiene, la del simulador por nombre. Nunca se buscan por parecido,
   para que "Sprite" no termine siendo "Sprite Burst". */
/** servidor del simulador: de ahí salen las imágenes de fichas que traen los replays */
export const SIM_ORIGIN='https://play.riftatlas.com';
export const isToken = name => !!name && OR.tokens.has(norm(name));
// tokens que el simulador sí publica en /tokens (revisado en oct 2026); Bomb y XP Tracker no tienen imagen en ningún lado
const SIM_TOKENS=new Set(['Bird','Brush','Gold','Mech','Recruit','Reflection','SandSoldier','ShadowClone','Sprite','Tentacle']);
export function tokenCard(name,imageUrl){
  const or=OR.tokens.get(norm(name||'')), file=(name||'').replace(/[^A-Za-z0-9]/g,'');
  const img = imageUrl ? (/^https?:/.test(imageUrl) ? imageUrl : SIM_ORIGIN+(imageUrl.startsWith('/')?'':'/')+imageUrl)
    : or?.img || (SIM_TOKENS.has(file) ? `${SIM_ORIGIN}/tokens/${file}.webp` : '');
  if(!img) return null;   // sin imagen: se muestra el nombre en la carta
  return { name:or?.name||name||'', img, text:or?.text||'', type:or?.type||'Token', m:or?.might??null, might:or?.might??null, token:true };
}
/* ---- datos para el constructor de mazos (src/deck) ---- */
const toDeckCard = c => c && ({ code:c.code, name:c.name, type:c.type, sup:c.sup||null, dom:c.dom||[], tags:c.tags||[], e:c.e??null, m:c.m??null, pw:c.pw??null });
/** carta por código para las reglas del mazo (acepta variantes como "UNL-079A") */
export function deckCard(code){
  if(!code) return undefined;
  if(!BYCODE) cardByCode(code);   // arma el índice
  const c=BYCODE.get(code.toUpperCase()) || BYCODE.get(code.toUpperCase().replace(/[A-Z*]+$/,''));
  return c ? {...toDeckCard(c), code} : undefined;
}
/**
 * Qué impresión preferir cuando una lista trae solo el nombre: primero la normal, después las promocionales
 * (por ejemplo "Flash" existe como OGS-011 y como promo OPP-011) y al final las de arte alterno.
 */
export const printRank = c => (c.alt ? 2 : 0) + (c.rar === 'Promo' || c.set === 'OPP' ? 1 : 0);
/** catálogo del constructor: una impresión por nombre (la normal, del set más antiguo) */
let CATALOG=null;
export function deckCatalog(){
  if(CATALOG) return CATALOG;
  const byName=new Map();
  for(const c of CARDS){ if(!c.code || c.sup==='Token') continue; const o=byName.get(c.name);
    if(!o || printRank(c) < printRank(o)) byName.set(c.name,c); }
  return CATALOG=[...byName.values()];
}
export function setStatus(t,c){ const s=$('#status'); s.textContent=t; s.className=c||''; }

/* OpenRift: respaldo para cartas que riftcodex no tiene (public/openrift-catalog.json, se genera con "npm run catalogo") */
export let OR=emptyIndex();
let OR_CAT=null;
/** catálogo completo de OpenRift (impresiones de cada set), o null si aún no carga */
export const orCatalog = () => OR_CAT;
/** suma al catálogo las cartas que solo tiene OpenRift (sets nuevos como Radiance, que riftcodex aún no publica) */
function mergeOpenRift(){
  if(!OR_CAT) return;
  CARDS=CARDS.filter(c=>c.src!=='openrift');
  // fuera las variantes de cartas que riftcodex ya tiene ("OGN-095*" si ya está "OGN-095") y los nombres repetidos
  const have=new Set(CARDS.map(c=>c.code)), names=new Set(CARDS.map(c=>c.n));
  CARDS=CARDS.concat(openRiftExtraCards(OR_CAT,norm,have).filter(c=>!have.has(c.code.replace(/[A-Z*]+$/,'')) && !names.has(c.n)));
}
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
  if(OR.tokens.has(k) && !CARDS.some(c=>c.n===k)){ const t=tokenCard(name); cache.set(k,t); return t; }
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
  fetch(pub('openrift-catalog.json')).then(r=>r.ok?r.json():null).then(cat=>{
    if(!cat) return; OR_CAT=cat; OR=buildOpenRiftIndex(cat,norm); cache.clear(); BYCODE=null; if(API_DONE) ready(); else document.dispatchEvent(new Event('rb:cards'));
  }).catch(()=>{});
}
