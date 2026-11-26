// Generado a partir de legacy/app.js (sección "chart").
import { parseDeck } from '../replay/deck';
import { deckRawOf } from './replay';
import { $, stage } from './base';
import { app } from './state';
import { esc, hold } from './utils';

/* ================= 4. Gráfica de puntos ================= */
export function analyze(){
  const F=app.R.frames, byTurn=new Map();
  for(const f of F){ if(f.state.phase!=='in_game') continue; const sc={}; f.state.players.forEach(p=>sc[p.id]=p.board?.score||0); byTurn.set(f.state.turnNumber||0,sc); }
  app.R.series=[...byTurn].sort((a,b)=>a[0]-b[0]).map(([t,sc])=>({t,sc}));
  const seen=new Set(), logs=[]; F.forEach(f=>f.newLogs.forEach(l=>{ if(!seen.has(l.id)){ seen.add(l.id); logs.push(l); } }));
  const owner=l=> app.R.players.some(p=>p.id===l.authorPlayerId) ? l.authorPlayerId : app.R.players.find(p=>(l.text||'').startsWith(p.name+' '))?.id;
  const st={}; app.R.players.forEach(p=>st[p.id]={plays:0,conq:0,cards:{}}); app.R.conquests=[];
  for(const l of logs){ const p=owner(l); if(!p) continue; let m;
    if((m=(l.text||'').match(/played (.+?) from hand/i))){ st[p].plays++; st[p].cards[m[1]]=(st[p].cards[m[1]]||0)+1; }
    if((m=(l.text||'').match(/conquered (.+?)(?: and scored|\.$)/))){ st[p].conq++; app.R.conquests.push({t:l.turnNumber,pid:p,name:m[1]}); } }
  app.R.stats=st;
  const lf=F[F.length-1]; app.R.duration=lf.elapsedMs||0;
  app.R.decks={}; lf.state.players.forEach(p=>app.R.decks[p.id]=parseDeck(deckRawOf(p)));
}
export function chartSVG(w,h){
  const S=app.R.series; if(!S.length) return '<p>Sin datos de puntos</p>';
  const pad={l:60,r:30,t:60,b:56}, minT=S[0].t, maxT=S[S.length-1].t;
  const maxY=Math.max(8,...S.flatMap(s=>Object.values(s.sc)));
  const X=t=>pad.l+(maxT===minT?0.5:(t-minT)/(maxT-minT))*(w-pad.l-pad.r), Y=v=>h-pad.b-(v/maxY)*(h-pad.t-pad.b);
  let g='';
  for(let v=0; v<=maxY; v+=maxY>12?2:1) g+=`<line x1="${pad.l}" x2="${w-pad.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#ffffff14"/><text x="${pad.l-14}" y="${Y(v)+6}" fill="#8b97b0" font-size="17" text-anchor="end">${v}</text>`;
  const step=Math.ceil(S.length/24);
  S.forEach((s,k)=>{ if(k%step===0||k===S.length-1) g+=`<text x="${X(s.t)}" y="${h-pad.b+28}" fill="#8b97b0" font-size="16" text-anchor="middle">${s.t}</text>`; });
  g+=`<text x="${w/2}" y="${h-4}" fill="#8b97b0" font-size="15" letter-spacing="2" text-anchor="middle">TURNO</text>`;
  let lines='', dots='';
  app.R.players.forEach(p=>{ const pts=S.map(s=>[X(s.t).toFixed(1),Y(s.sc[p.id]||0).toFixed(1)]);
    lines+=`<path class="ln" pathLength="1" stroke="${p.col}" d="M${pts.map(q=>q.join(',')).join(' L')}"/>`;
    const lp=pts[pts.length-1]; dots+=`<circle cx="${lp[0]}" cy="${lp[1]}" r="9" fill="${p.col}"/>`; });
  app.R.conquests.forEach(c=>{ const p=app.R.players.find(x=>x.id===c.pid), s=S.find(x=>x.t===c.t); if(!p||!s) return;
    dots+=`<rect x="-8" y="-8" width="16" height="16" fill="#0b0f17" stroke="${p.col}" stroke-width="3" transform="translate(${X(c.t)},${Y(s.sc[c.pid]||0)}) rotate(45)"/>`; });
  const legend=app.R.players.map((p,k)=>`<g transform="translate(${pad.l+k*230},14)"><rect width="20" height="20" rx="5" fill="${p.col}"/><text x="30" y="17" fill="#e6ebf5" font-size="20">${esc(p.name)}</text></g>`).join('')
    +`<g transform="translate(${w-pad.r-170},14)"><rect x="4" y="4" width="13" height="13" transform="rotate(45 10 10)" fill="none" stroke="#e6ebf5" stroke-width="2.5"/><text x="30" y="17" fill="#8b97b0" font-size="17">conquista</text></g>`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Source Sans 3,sans-serif">${g}${legend}${lines}<g class="dots">${dots}</g></svg>`;
}
export function drawChart(box,w,h){ box.innerHTML=chartSVG(w,h); box.classList.remove('draw'); void box.offsetWidth; requestAnimationFrame(()=>box.classList.add('draw')); }
export async function showChart(secs){
  const ov=$('#chartov'), v=stage.className==='v';
  drawChart(ov.querySelector('.chartbox'), v?1000:1600, v?900:760); ov.classList.add('show');
  if(secs){ await hold(secs*1000); ov.classList.remove('show'); }
}

export function init() {
  $('#bChart').onclick=()=>{ if(!app.R) return; const ov=$('#chartov'); if(ov.classList.contains('show')) ov.classList.remove('show'); else { $('#sumov').classList.remove('show'); showChart(0); } };
}
