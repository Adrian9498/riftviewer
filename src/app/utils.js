// Generado a partir de legacy/app.js (sección "utils").
import { $ } from './base';
import { rJump } from './replay-render';
import { idx, jumpTo } from './script-engine';
import { app } from './state';

/* ================= Utilidades comunes ================= */
export const sleep = ms => new Promise(r=>setTimeout(r,ms));
export const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// espera en tiempo real (no depende de la velocidad) y se corta si cambia la reproducción
export async function hold(ms){ const my=app.token, end=Date.now()+ms; while(Date.now()<end && my===app.token) await sleep(80); }
export function openModal(title,body,buttons){
  const m=$('#modal'); m.querySelector('h2').textContent=title; m.querySelector('.mbody').innerHTML=body;
  const f=m.querySelector('.mfoot'); f.innerHTML='';
  buttons.forEach(([label,cls,fn])=>{ const b=document.createElement('button'); b.className='btn '+(cls||''); b.textContent=label;
    b.onclick=()=>{ if(fn && fn()===false) return; closeModal(); }; f.appendChild(b); });
  m.classList.add('show'); return m.querySelector('.mbody');
}
export function closeModal(){ $('#modal').classList.remove('show'); }
export function fileToDataURL(file,maxH){
  return new Promise((res,rej)=>{ const img=new Image();
    img.onload=()=>{ const s=Math.min(1,maxH/img.height), c=document.createElement('canvas');
      c.width=Math.round(img.width*s); c.height=Math.round(img.height*s); c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(img.src); res(c.toDataURL(file.type==='image/png'?'image/png':'image/jpeg',0.9)); };
    img.onerror=rej; img.src=URL.createObjectURL(file); });
}
export function rerender(){ if(app.R){ app.R.layoutKey=''; rJump(app.R.i); } else jumpTo(idx); }

export function init() {
  $('#modal').addEventListener('mousedown',e=>{ if(e.target.id==='modal') closeModal(); });
}
