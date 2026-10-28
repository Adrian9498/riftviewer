// Generado a partir de legacy/app.js (sección "brand").
import { $, stage } from './base';
import { CUSTOM, IDB, setStatus } from './cards';
import { buildFrameList } from './replay';
import { app } from './state';
import { esc, fileToDataURL, openModal, rerender } from './utils';

/* ================= 6. Mi marca ================= */
export const BGS={night:'radial-gradient(ellipse at 50% 50%,#1b2a44 0%,#0e1524 55%,#070a11 100%)',purple:'radial-gradient(ellipse at 50% 50%,#3a1f5c 0%,#1a0f2e 55%,#09060f 100%)',
  green:'radial-gradient(ellipse at 50% 50%,#173d33 0%,#0c2019 55%,#050c09 100%)',red:'radial-gradient(ellipse at 50% 50%,#4a1a22 0%,#240c11 55%,#0d0507 100%)',black:'#050608',chroma:'#00b140'};
export let BR={name:'',pos:'br',cols:['#3fa9ff','#ff5a6e','#b57bff','#45d483'],bg:'night',scale:100,align:'center'};
export const BRIMG={logo:null,bg:null};
export function applyBrand(){
  app.PCOL=[...BR.cols]; BR.cols.forEach((c,k)=>document.documentElement.style.setProperty('--p'+(k+1),c));
  $('#bg').style.background = BR.bg==='img'&&BRIMG.bg ? `center/cover no-repeat url("${BRIMG.bg}")` : (BGS[BR.bg]||BGS.night);
  const b=$('#brand'); b.className=BR.pos; b.innerHTML=(BRIMG.logo?`<img src="${BRIMG.logo}">`:'')+(BR.name?`<span>${esc(BR.name)}</span>`:'');
  const s=BR.scale/100, org={center:'center center',left:'left center',right:'right center',top:'center top',bottom:'center bottom',tl:'left top',tr:'right top',bl:'left bottom',br:'right bottom'};
  const inn=$('#inner'); inn.style.transformOrigin=org[BR.align]||'center center'; inn.style.transform=s<1?`scale(${s})`:''; stage.dataset.is=s;
  try{ localStorage.setItem('rb_brand',JSON.stringify(BR)); }catch(e){}
  if(app.R){ app.R.players.forEach((p,k)=>p.col=app.PCOL[k%4]); buildFrameList(); }
}
export let BRTARGET=null;

export function init() {
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
}
