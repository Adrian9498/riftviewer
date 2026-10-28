// Generado a partir de legacy/app.js (sección "hover").
import { stage } from './base';
import { REC } from './export';
import { PICK } from './notes';
import { esc } from './utils';
import { cardTextHTML } from '../data/symbols';

/* ================= Vista ampliada al pasar el mouse (no aparece al grabar) ================= */
export const HP={el:null,timer:null,target:null,pinned:false,x:0,y:0};
export function hpHide(){ clearTimeout(HP.timer); HP.target=null; if(!HP.pinned) HP.el.classList.remove('show'); }
export function hpPlace(){
  const r=HP.el.getBoundingClientRect(), pad=18;
  let x=HP.x+pad, y=HP.y-r.height/2;
  if(x+r.width>innerWidth-8) x=HP.x-pad-r.width;
  y=Math.max(8,Math.min(innerHeight-r.height-8,y));
  HP.el.style.left=x+'px'; HP.el.style.top=y+'px';
}
export function hpShow(t){
  const d=t._data, name=d?.name||t._iname||t._card?.name||'Carta';
  const land=t.classList.contains('fhead') || d?.type==='Battlefield' || d?.type==='battlefield';
  HP.el.className='show'+(land?' land':'');
  HP.el.innerHTML=(d?.img?`<img src="${d.img}" alt="">`:`<div class="noimg">Sin imagen<br><small>clic derecho para poner una</small></div>`)
    +`<div class="hn">${esc(name)}</div>${d?.text||d?.rich?`<div class="ht">${cardTextHTML(d.rich,d.text)}</div>`:''}<div class="hk">Mantén <b>Shift</b> para fijarla</div>`;
  const img=HP.el.querySelector('img'); if(img) img.onload=hpPlace;
  hpPlace();
}

export function init() {
  HP.el=document.createElement('div'); HP.el.id='hoverprev'; document.body.appendChild(HP.el);
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
}
