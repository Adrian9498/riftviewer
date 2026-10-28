// Generado a partir de legacy/app.js (sección "fit").
import { $, stage } from './base';

/* ================= Escala del escenario ================= */
export function scale(){ return parseFloat(stage.dataset.s||'1') * parseFloat(stage.dataset.is||'1'); }
export function fit(){
  const vp=$('#viewport'), w=stage.offsetWidth, h=stage.offsetHeight;
  const s=Math.min(vp.clientWidth/w, vp.clientHeight/h);
  stage.dataset.s=s; stage.style.transform=`translate(-50%,-50%) scale(${s})`;
}
export const innerRect = () => $('#inner').getBoundingClientRect();

export function init() {
  addEventListener('resize',fit);
}
