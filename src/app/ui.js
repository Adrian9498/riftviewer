// Generado a partir de legacy/app.js (sección "ui").
import { norm } from '../data/text';
import { $, stage } from './base';
import { BR, BRIMG, applyBrand } from './brand';
import { CARDS, CUSTOM, IDB, loadCards } from './cards';
import { DEMO } from './demo';
import { REC } from './export';
import { fit } from './fit';
import { rJump, rPlay, rStep } from './replay-render';
import { startFrame } from './replay';
import { idx, jumpTo, play, reset, run, stepForward } from './script-engine';
import { DOC, autosaveScript, openHelp, renderRecents, saveRecent, togglePanel } from './shell';
import { SFX, openSounds } from './sounds';
import { app } from './state';
import { rerender } from './utils';

export function init() {
  
  /* ================= UI ================= */
  $('#bLoad').onclick=run;
  $('#bPlay').onclick=()=> app.R ? rPlay() : play();
  $('#bNext').onclick=async()=>{ app.playing=false; if(app.R) await rStep(); else await stepForward(); };
  $('#bPrev').onclick=()=>{ app.playing=false; if(app.R) rJump(app.R.i-1); else jumpTo(Math.max(0,idx-1)); };
  $('#bStart').onclick=()=>{ app.playing=false; if(app.R) rJump(startFrame()); else jumpTo(0); };
  $('#speed').onchange=e=>app.speed=parseFloat(e.target.value);
  $('#bRec').onclick=()=>{ document.body.classList.toggle('rec'); fit(); };
  $('#bSave').onclick=()=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([$('#script').value],{type:'text/plain'})); a.download=`${(DOC.name||'partida').replace(/[\\/:*?"<>|]+/g,'_')}.txt`; a.click(); };
  $('#script').addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.ctrlKey){ e.preventDefault(); run(); } });
  $('#script').addEventListener('input',autosaveScript);
  document.addEventListener('keydown',e=>{
    if(['TEXTAREA','INPUT','SELECT'].includes(document.activeElement.tagName)) return;
    if($('#home').classList.contains('show') || document.body.classList.contains('indecks') || $('#modal').classList.contains('show') || $('#tour').classList.contains('show')) return;
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
  // la primera vez con estilos, el fondo que venía por defecto pasa a ser el del estilo
  try{ const s=localStorage.getItem('rb_skin'); if(!s && BR.bg==='night') BR.bg='skin';
    stage.dataset.skin=s==='pro'?'pro':'fan'; document.querySelectorAll('#skinseg button').forEach(b=>b.classList.toggle('on',b.dataset.s===stage.dataset.skin)); }catch(e){}
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
    applyBrand(); openSounds(); if(CUSTOM.size && CARDS.length) rerender();
  }).catch(()=>{});
}
