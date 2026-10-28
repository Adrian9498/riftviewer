// Generado a partir de legacy/app.js (sección "layout-lanes").
import { $, stage } from './base';
import { cardByCode, imgKey } from './cards';
import { BFZ, ZHTML, hudHTML, setClip } from './replay';
import { buildMinimap } from './replay-render';
import { app } from './state';
import { esc } from './utils';

/* ---- Mesa de carriles: cada jugador es un carril; los campos son columnas compartidas ---- */
export function buildLanes(fmt){
  const W=stage.offsetWidth, H=stage.offsetHeight, P=app.R.players, n=P.length, pad=12, gap=10, cam=$('#rcam');
  const fields=[]; P.forEach((p,k)=>{ if(p.bfCode||p.bfName) fields.push({z:BFZ[k],code:p.bfCode,name:p.bfName}); });
  const g={fmt,lay:'lanes',lanes:new Map()}; app.R.geo=g;
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
  const vp=P.find(p=>p.id===app.R.view)||P[0], hz=document.createElement('div');
  hz.className='zone z-hand cmp rhandz'; hz.dataset.z='hand'; hz.style.setProperty('--pc',vp.col);
  Object.assign(hz.style,{left:handBox.x+'px',top:handBox.y+'px',width:handBox.w+'px',height:handBox.h+'px'});
  hz.innerHTML=`<label>Mano de ${esc(vp.name)}</label>`; $('#rboard').appendChild(hz);
  cam.querySelector(`.rstrip[data-p="${vp.id}"]`)._hand=hz;
  app.R.fieldDefs=fields; fields.forEach((f,k)=>R_addField(f.z,f.code,f.name,'ABCD'[k]));
  buildMinimap();
}
export function R_addField(z,code,name,label){
  const lanes=stage.dataset.lay==='lanes';
  const d=document.createElement('div'); d.className='rfield'+(lanes?' lanes':''); d.dataset.z=z;
  const c=cardByCode(code,name);
  const ik=imgKey(code,name), safe=(name||'').replace(/"/g,'&quot;');
  d.innerHTML=`<div class="fbg"${c?` style="background-image:url('${c.img}')"`:''}></div>
    <div class="fhead" data-ikey="${ik}" data-iname="${safe}"><span class="flabel">${label}</span><span class="bfname">${esc(c?.name||name||'')}</span>${c?'':'<small class="fhint">clic derecho: poner imagen</small>'}<span class="fown"></span></div><div class="units">`+
    (lanes?app.R.players:[...app.R.players].sort((a,b)=>(a.id===app.R.view)-(b.id===app.R.view))).map(p=>`<div class="grp cmp" data-p="${p.id}" style="--pc:${p.col}"></div>`).join('')+`</div>`;
  d.querySelector('.fhead')._data=c; d.querySelector('.fhead')._iname=name;
  $('#rfields').appendChild(d); return d;
}

export function rCardEl(c,owner){
  let e=app.R.el.get(c.id);
  if(!e){
    e=document.createElement('div'); e.className='card own'; e.innerHTML='<div class="face"></div>';
    e.style.setProperty('--pc',app.R.players.find(p=>p.id===owner)?.col||'#888');
    app.R.el.set(c.id,e); e._new=true;
  }
  const data=cardByCode(c.cardCode,c.name);
  e._data=data; e._card=c; e._owner=owner; e._cid=c.id;
  e.dataset.ikey=imgKey(c.cardCode,c.name); e.dataset.iname=c.name||'';
  return e;
}
export function rPaint(e,zone){
  const c=e._card, f=e.querySelector('.face'), pol=$('#rhands').value;
  const back = c.hidden || (zone==='hand' && (pol==='none' || (pol==='view' && e._owner!==app.R.view)));
  e.classList.toggle('back',!!back);
  e.classList.toggle('exhausted',!!c.exhausted && zone!=='hand' && zone!=='trash');
  if(back){ f.className='face'; f.style.backgroundImage=''; f.textContent=''; }
  else if(e._data){ f.className='face'; f.textContent=''; f.style.backgroundImage=`url("${e._data.img}")`; }
  else { f.className='face ph'; f.style.backgroundImage=''; f.textContent=c.name||'?'; }
}
export function compress(box,avail){
  const kids=[...box.children].filter(k=>k.classList.contains('card'));
  kids.forEach(k=>k.style.marginLeft='');
  if(kids.length<2 || box.classList.contains('wrap2')) return;
  const cw=kids[0].offsetWidth, gap=8;
  avail = avail || (box.clientWidth-16);
  const need=kids.length*cw+(kids.length-1)*gap;
  if(need>avail){ const ov=(need-avail)/(kids.length-1)+gap; kids.slice(1).forEach(k=>k.style.marginLeft=(-ov)+'px'); }
}
// zonas que se acomodan en varias filas: achica las cartas hasta que quepan todas
export function fitWrap(box){
  box.style.removeProperty('--cw'); box.style.removeProperty('--ch');
  let cw=parseFloat(getComputedStyle(box).getPropertyValue('--cw'))||100;
  for(let k=0;k<12 && box.scrollHeight>box.clientHeight+2 && cw>40;k++){
    cw*=0.88; box.style.setProperty('--cw',cw+'px'); box.style.setProperty('--ch',(cw*1.4)+'px'); }
}
// unidades en un campo: lo más grandes posible según cuántos jugadores y unidades hay
export function fitField(fe){
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
export function fitCells(fe){
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