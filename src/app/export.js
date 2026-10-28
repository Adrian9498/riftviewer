// Generado a partir de legacy/app.js (sección "export").
import { isPremium } from '../cloud/plan';
import { $, ic, stage } from './base';
import { startFrame } from './replay';
import { openUpsell } from './premium';
import { setStatus } from './cards';
import { PROJ, clipSeg, frameText, markIds } from './clips';
import { fit } from './fit';
import { rJump, rPos, rStep } from './replay-render';
import { STEPS, banner, idx, jumpTo, stepForward, updatePos, wait } from './script-engine';
import { DOC, setFmt, toast } from './shell';
import { SFX, SND } from './sounds';
import { app } from './state';
import { posLabel, sectionLabel } from './transport';
import { esc, hold, openModal, sleep } from './utils';

/* ================= 1. Exportar video ================= */
export const REC={on:false,stopped:false,track:null,stop(){ this.stopped=true; app.token++; app.playing=false; try{ this.track?.stop(); }catch(e){} }};
// cambia al formato de la plantilla mientras graba y luego vuelve al que tenías
/* tramos para "Un tramo de turnos": Preparación, Mulligan y cada turno, con su primera y última jugada */
export function exportSections(){
  const out=[], n=PB.count();
  for(let i=0;i<n;i++){
    const label=app.R?sectionLabel(i):(PB.turn(i)?`Turno ${PB.turn(i)}`:'Preparación'), s=out[out.length-1];
    if(s&&s.label===label) s.last=i; else out.push({label,first:i,last:i});
  }
  return out;
}
const placeText = i => app.R ? posLabel(i) : `el paso ${i+1}`;
export async function exportWith(segs,fmt,fps){
  const prev=stage.className; if(fmt!==prev) setFmt(fmt);
  await recordVideo(segs,fps);
  if(fmt!==prev) setFmt(prev);
}
export async function recordVideo(segs,fps=60){
  const full=isPremium(); if(!full) fps=Math.min(fps,30);   // Gratis: 30 fps y 720p (Full Access: resolución completa y 60 fps)
  let stream;
  try{ stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:fps,max:fps}},audio:false,preferCurrentTab:true,selfBrowserSurface:'include',surfaceSwitching:'exclude'}); }
  catch(e){ setStatus('Grabación cancelada','err'); return; }
  const track=stream.getVideoTracks()[0]; REC.track=track;
  try{ if(window.CropTarget && track.cropTo) await track.cropTo(await CropTarget.fromElement(stage)); }catch(e){}
  if(!full){ const v=stage.className==='v';
    try{ await track.applyConstraints({width:{max:v?720:1280},height:{max:v?1280:720},frameRate:{max:30}}); }catch(e){} }
  // el usuario confirma: así también podemos poner pantalla completa
  await new Promise(res=>{ $('#startrec').classList.add('show');
    $('#bGo').onclick=async()=>{ $('#startrec').classList.remove('show'); try{ await document.documentElement.requestFullscreen(); }catch(e){} res(); }; });
  REC.on=true; REC.stopped=false;
  document.body.classList.add('rec','recording'); await sleep(900); fit(); await sleep(500);
  // mezclar el video de la pestaña con los efectos de sonido de Riftviewer
  const actx=SND.on?SFX.ensure():null, withAudio=!!(actx&&SFX.dest);
  const recStream=new MediaStream([...stream.getVideoTracks(), ...(withAudio?SFX.dest.stream.getAudioTracks():[])]);
  const types=withAudio ? ['video/mp4;codecs=avc1.640028,mp4a.40.2','video/mp4;codecs=avc1,mp4a.40.2','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']
                        : ['video/mp4;codecs=avc1.640028','video/mp4','video/webm;codecs=vp9','video/webm'];
  const mime=types.find(t=>MediaRecorder.isTypeSupported(t))||'';
  const rec=new MediaRecorder(recStream,{mimeType:mime,videoBitsPerSecond:fps>30?16e6:10e6,audioBitsPerSecond:160000}), chunks=[];
  rec.ondataavailable=e=>{ if(e.data.size) chunks.push(e.data); };
  const done=new Promise(r=>rec.onstop=r);
  track.onended=()=>{ if(REC.on) REC.stop(); };
  rec.start(1000);
  for(const s of segs){ if(REC.stopped) break; if(await playSegment(s)===false && !REC.stopped) break; }
  if(!REC.stopped) await sleep(700);
  REC.on=false;
  if(rec.state!=='inactive') rec.stop();
  await done; try{ track.stop(); }catch(e){}
  if(document.fullscreenElement) await document.exitFullscreen().catch(()=>{});
  document.body.classList.remove('recording'); await sleep(300); fit();
  if(!chunks.length){ setStatus('No se grabó nada','err'); return; }
  const type=rec.mimeType||'video/webm', ext=type.includes('mp4')?'mp4':'webm', blob=new Blob(chunks,{type});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`partida-${new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')}.${ext}`; a.click();
  setStatus(`Video exportado: ${a.download} (${(blob.size/1048576).toFixed(1)} MB)`,'ok');
}
/* Reproducción común: la misma interfaz para guiones y replays.
   En un guion, la "jugada actual" es el último paso ejecutado (idx-1). */
export const PB={
  count(){ return app.R ? app.R.frames.length : STEPS.length; },
  cur(){ return app.R ? app.R.i : idx-1; },
  label(i){ if(app.R) return frameText(i); const s=STEPS[i]; return s ? ($('#script').value.split(/\r?\n/)[s.line-1]||'').trim() : ''; },
  turn(i){ return app.R ? (app.R.frames[i]?.state.turnNumber||0) : STEPS.slice(0,i+1).filter(s=>s.cmd==='turno').length; },
  async jump(i){ if(app.R) rJump(i); else await jumpTo(i+1); },
  step(){ return app.R ? rStep() : stepForward(); },
  pos(){ if(app.R) rPos(); else updatePos(); }
};
export async function playSegment(s){
  await PB.jump(s.from); const my=app.token; app.playing=true; PB.pos(); await sleep(400);
  if(s.label) await banner(`<span style="font-size:56px">${esc(s.label)}</span>`,1800);
  while(app.playing && my===app.token && PB.cur()<s.to){ if(!await PB.step()) break; await wait(150); }
  const complete = my===app.token && PB.cur()>=s.to;
  if(my===app.token){ app.playing=false; PB.pos(); await hold(700); }
  return complete;
}

export function init() {
  $('#bExport').onclick=()=>{
    if(!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder){ alert('Tu navegador no permite grabar video. Usa Chrome o Edge en la PC.'); return; }
    if(!DOC.kind){ toast('Abre primero un replay o un guion','err'); return; }
    app.playing=false;
    // "inicio" de la partida: en replay, donde empieza el juego (o el principio); en guion, antes del primer paso
    const last=PB.count()-1, start=app.R?startFrame():-1, cur=PB.cur(), nClips=markIds().length;
    // qué grabar: se elige en palabras (partida, desde aquí, jugada, clips o un tramo de turnos), no por número de jugada
    const full=isPremium(), secs=exportSections(), where=cur>=0?placeText(cur):'';
    const curSec=Math.max(0,secs.findIndex(s=>cur>=s.first&&cur<=s.last)), minFrom=app.R?0:-1;
    const W={
      all:  {ic:'replay', t:'Partida completa', d:'De principio a fin', prem:true, segs:()=>[{from:start,to:last}]},
      here: {ic:'next', t:'Desde aquí hasta el final', d:cur>start?`Desde ${where}`:'Avanza primero a una jugada', prem:true, off:cur<=start, segs:()=>[{from:Math.max(start,cur),to:last}]},
      play: {ic:'target', t:'Solo esta jugada', d:cur>=0?`${where}, con ${PROJ.before} jugadas antes y ${PROJ.after} después`:'Avanza primero a una jugada', off:cur<0, segs:()=>[clipSeg(cur)]},
      clips:{ic:'star', t:`Mis clips${nClips?` (${nClips})`:''}`, d:nClips?'Todos en un solo video, cada uno con su título':'Márcalos con la estrella o con el botón Clip', prem:true, off:!nClips, segs:()=>markIds().map(clipSeg)},
      turns:{ic:'list', t:'Un tramo de turnos', d:'Eliges desde qué turno y hasta cuál', segs:()=>{ const a=+$('#exFrom').value, b=+$('#exTo').value; return [{from:Math.max(minFrom,secs[a].first-1),to:secs[b].last}]; }},
    };
    const opts=secs.map((s,k)=>`<option value="${k}">${esc(s.label)}</option>`).join('');
    const body=openModal('Exportar video',`
      <h4 class="full exh">Qué grabar</h4>
      <div class="full presets">${Object.entries(W).map(([k,p])=>{ const lock=p.prem&&!full;
        return `<button class="preset${lock?' locked':''}" data-p="${k}" ${p.off?'disabled':''}><span class="pi">${ic(p.ic)}</span><span><b>${p.t}${lock?' 🔒':''}</b><small>${esc(p.d)}</small></span></button>`; }).join('')}</div>
      <div class="full exturns" hidden><span>Desde</span><select id="exFrom">${opts}</select><span>hasta</span><select id="exTo">${opts}</select></div>
      <h4 class="full exh">Formato</h4>
      <div class="full exfmt"><button data-fmt="h"><span class="ar h"></span><span><b>16:9</b><small>YouTube</small></span></button><button data-fmt="v"><span class="ar v"></span><span><b>9:16</b><small>Shorts, TikTok, Reels</small></span></button></div>
      <h4 class="full exh">Detalles</h4>
      <span>Fluidez</span><select id="exFps"><option value="60">60 fps (más fluido)</option><option value="30">30 fps (archivo más ligero)</option></select>
      <span>Título inicial</span><input type="text" id="exTitle" placeholder="Opcional: Diana vs Seraphine">
      ${full?'':`<div class="full hint">Plan Gratis: 720p · 30 fps, con una marca de agua pequeña. <a href="#" data-up>Ver Full Access</a></div>`}
      <div class="full exsum" id="exSum"></div>
      <div class="full hint">Al pulsar <b>Grabar</b>, el navegador te pedirá compartir <b>esta pestaña</b>: elígela y acepta. Se graba solo la mesa, con sonido y en pantalla completa.${app.R&&$('#rauto').value==='1'?' Si el video llega al final, incluye el resumen y los mazos.':''}</div>`,
      [['Cancelar'],['Grabar','primary',()=>{
        const k=body.querySelector('.preset.on')?.dataset.p; if(!k){ alert('Elige qué quieres grabar.'); return false; }
        if(k==='turns' && +$('#exTo').value < +$('#exFrom').value){ alert('El turno final debe ser igual o posterior al inicial.'); return false; }
        const segs=W[k].segs(), fmt=body.querySelector('.exfmt .on')?.dataset.fmt||stage.className, fps=+$('#exFps').value;
        const title=$('#exTitle').value.trim(); if(title && segs.length===1) segs[0].label=title;
        exportWith(segs,fmt,fps); }]]);
    $('#exFrom').value=curSec; $('#exTo').value=secs.length-1;
    const summary=()=>{
      const k=body.querySelector('.preset.on')?.dataset.p; if(!k){ $('#exSum').textContent=''; return; }
      const n=W[k].segs().reduce((t,s)=>t+Math.max(0,s.to-s.from),0);
      $('#exSum').innerHTML=`${ic('replay')} Se grabarán <b>${n} jugada${n===1?'':'s'}</b>${W[k].segs().length>1?` en ${W[k].segs().length} partes`:''}.`;
    };
    const setFmt=f=>body.querySelectorAll('.exfmt button').forEach(b=>b.classList.toggle('on',b.dataset.fmt===f));
    setFmt(stage.className);
    body.onchange=summary;
    body.onclick=e=>{
      if(e.target.closest('[data-up]')){ e.preventDefault(); openUpsell('export_hd'); return; }
      const f=e.target.closest('[data-fmt]'); if(f){ setFmt(f.dataset.fmt); return; }
      const b=e.target.closest('.preset'); if(!b||b.disabled) return;
      if(b.classList.contains('locked')){ openUpsell('export_presets'); return; }
      body.querySelectorAll('.preset').forEach(x=>x.classList.toggle('on',x===b)); body.querySelector('.exturns').hidden=b.dataset.p!=='turns'; summary(); };
    const first=body.querySelector('.preset:not(.locked):not([disabled])'); if(first) first.click();
  };
}
