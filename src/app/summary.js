// Generado a partir de legacy/app.js (sección "summary").
import { $, stage } from './base';
import { cardByCode } from './cards';
import { drawChart } from './chart';
import { arr } from './replay';
import { winnersOf } from '../replay/events';
import { app } from './state';
import { esc, hold } from './utils';

/* ================= 5. Resumen final ================= */
export function sumPage1(){
  const lastSt=app.R.frames[app.R.frames.length-1].state, out=winnersOf(lastSt), v=stage.className==='v';
  const win=app.R.players.filter(p=>out.includes(p.id));
  const mm=Math.floor(app.R.duration/60000), ss=String(Math.floor(app.R.duration/1000)%60).padStart(2,'0');
  const turns=app.R.series.length?app.R.series[app.R.series.length-1].t:0;
  const cards=app.R.players.map(p=>{
    const b=lastSt.players.find(x=>x.id===p.id)?.board||{}, leg=arr(b.legend)[0], ld=leg&&cardByCode(leg.cardCode,leg.name), s=app.R.stats[p.id];
    const fav=Object.entries(s.cards).sort((a,b)=>b[1]-a[1])[0], fd=fav&&cardByCode(null,fav[0]);
    return `<div class="sp" style="--pc:${p.col}">${ld?`<img class="leg" src="${ld.img}">`:''}<div><div class="nm">${out.includes(p.id)?'<span class="crown">👑 </span>':''}${esc(p.name)}</div>
      <div class="rowst"><div><b>${b.score||0}</b><span>Puntos</span></div><div><b>${s.conq}</b><span>Conquistas</span></div><div><b>${s.plays}</b><span>Jugadas</span></div></div>
      ${fav?`<div class="fav">${fd?`<img src="${fd.img}">`:''}<span>Carta más jugada<br><b>${esc(fav[0])}</b> ×${fav[1]}</span></div>`:''}</div></div>`; }).join('');
  return `<div class="sum-head"><h3>RESUMEN DE LA PARTIDA</h3>
    <div class="win">${win.length?`Gana ${win.map(p=>`<span style="color:${p.col}">${esc(p.name)}</span>`).join(' &amp; ')}`:''}</div>
    <div class="meta">${turns} turnos · ${mm}:${ss} min · ${app.R.players.length} jugadores</div></div>
    <div class="sum-players">${cards}</div><div class="sum-chart chartbox"></div>`;
}
export function sumPage2(){
  return `<div class="sum-head"><h3>MAZOS</h3></div><div class="decks">${app.R.players.map(p=>{
    const d=app.R.decks[p.id]||{}, items=[...(d.Legend||[]).map(x=>({...x,key:1})),...(d.Champion||[]).map(x=>({...x,key:1})),...(d.MainDeck||[])];
    return `<div class="deck" style="--pc:${p.col}"><div class="nm">${esc(p.name)}</div><div class="grid">${items.map(x=>{ const c=cardByCode(x.code,x.name);
      return `<div class="dc${x.key?' key':''}" style="${c?`background-image:url('${c.img}')`:''}" title="${esc(x.name)}">${c?'':esc(x.name)}<b>${x.n}</b></div>`; }).join('') || '<span class="hint">Sin lista de mazo</span>'}</div></div>`; }).join('')}</div>`;
}
export function showSummary(page){
  const ov=$('#sumov'), v=stage.className==='v'; $('#chartov').classList.remove('show');
  ov.innerHTML=page===2?sumPage2():sumPage1(); ov.dataset.page=page; ov.classList.add('show');
  const cb=ov.querySelector('.sum-chart'); if(cb) drawChart(cb, v?980:1500, v?560:400);
}
export async function summarySequence(){
  const my=app.token; showSummary(1); await hold(8000); if(my!==app.token) return;
  showSummary(2); await hold(9000); if(my===app.token) $('#sumov').classList.remove('show');
}

export function init() {
  $('#bSum').onclick=()=>{ if(!app.R) return; const ov=$('#sumov'), p=ov.classList.contains('show')?+ov.dataset.page:0;
    if(p===0) showSummary(1); else if(p===1) showSummary(2); else ov.classList.remove('show'); };
}
