// Generado a partir de legacy/app.js (sección "export").
import { $, stage } from './base';
import { setStatus } from './cards';
import { PROJ, clipSeg, frameText, markIds } from './clips';
import { fit } from './fit';
import { rJump, rPos, rStep } from './replay-render';
import { STEPS, banner, idx, jumpTo, stepForward, updatePos, wait } from './script-engine';
import { DOC, setFmt, toast } from './shell';
import { SFX, SND } from './sounds';
import { app } from './state';
import { esc, hold, openModal, sleep } from './utils';

/* ================= 1. Exportar video ================= */
export const REC={on:false,stopped:false,track:null,stop(){ this.stopped=true; app.token++; app.playing=false; try{ this.track?.stop(); }catch(e){} }};
// cambia al formato de la plantilla mientras graba y luego vuelve al que tenías
export async function exportWith(segs,fmt,fps){
  const prev=stage.className; if(fmt!==prev) setFmt(fmt);
  await recordVideo(segs,fps);
  if(fmt!==prev) setFmt(prev);
}
export async function recordVideo(segs,fps=60){
  let stream;
  try{ stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:fps,max:fps}},audio:false,preferCurrentTab:true,selfBrowserSurface:'include',surfaceSwitching:'exclude'}); }
  catch(e){ setStatus('Grabación cancelada','err'); return; }
  const track=stream.getVideoTracks()[0]; REC.track=track;
  try{ if(window.CropTarget && track.cropTo) await track.cropTo(await CropTarget.fromElement(stage)); }catch(e){}
  // el usuario confirma: así también podemos poner pantalla completa
  await new Promise(res=>{ $('#startrec').classList.add('show');
    $('#bGo').onclick=async()=>{ $('#startrec').classList.remove('show'); try{ await document.documentElement.requestFullscreen(); }catch(e){} res(); }; });
  REC.on=true; REC.stopped=false;
  document.body.classList.add('rec','recording'); await sleep(900); fit(); await sleep(500);
  // mezclar el video de la pestaña con los efectos de sonido del visualizador
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
    const last=PB.count()-1, start=app.R?($('#rskip').value==='1'?app.R.start:0):-1, cur=PB.cur(), nClips=markIds().length;
    const P={
      yt:   {ic:'▶', t:'YouTube', d:'16:9 · 60 fps · partida completa', fmt:'h', fps:60, segs:()=>[{from:start,to:last}]},
      short:{ic:'📱', t:'Short / TikTok / Reels', d:`9:16 · 30 fps · desde la jugada actual${cur>start?` (#${cur})`:''} hasta el final`, fmt:'v', fps:30, segs:()=>[{from:Math.max(start,cur),to:last}]},
      clip: {ic:'✂', t:'Clip de la jugada actual', d:cur>=0?`Jugada #${cur} con ${PROJ.before} antes y ${PROJ.after} después · formato actual`:'Avanza primero a una jugada', fps:60, off:cur<0, segs:()=>[clipSeg(cur)]},
      clips:{ic:'⭐', t:'Todos los clips', d:nClips?`${nClips} clip${nClips>1?'s':''} en un solo video, con su título · formato actual`:'Todavía no marcaste clips (pestaña ⭐ Clips)', fps:60, off:!nClips, segs:()=>markIds().map(clipSeg)},
      custom:{ic:'⚙', t:'Personalizado', d:'Tú eliges formato, rango, título y fotogramas'}
    };
    const body=openModal('⏺ Exportar video',`
      <div class="full presets">${Object.entries(P).map(([k,p])=>`<button class="preset" data-p="${k}" ${p.off?'disabled':''}><span class="pi">${p.ic}</span><span><b>${p.t}</b><small>${esc(p.d)}</small></span></button>`).join('')}</div>
      <div class="full exc" hidden><div class="form">
        <span>Formato</span><select id="exFmt"><option value="h">16:9 horizontal</option><option value="v">9:16 vertical</option></select>
        <span>Desde la jugada</span><input type="number" id="exFrom" min="0" max="${last}" value="${Math.max(0,app.R?(cur>=last?start:cur):cur+1)}">
        <span>Hasta la jugada</span><input type="number" id="exTo" min="0" max="${last}" value="${last}">
        <span>Fotogramas</span><select id="exFps"><option>60</option><option>30</option></select>
      </div></div>
      <span>Título inicial</span><input type="text" id="exTitle" placeholder="Opcional. Ej: Diana vs Seraphine">
      <div class="full hint">El navegador te pedirá permiso para grabar <b>esta pestaña</b>: elígela y acepta. Se graba solo el tablero (con sonido), en pantalla completa.${app.R?' Si el video llega al final y "Al terminar" está en resumen, incluye el resumen y los mazos.':''}</div>`,
      [['Cancelar'],['⏺ Grabar','primary',()=>{
        const k=body.querySelector('.preset.on')?.dataset.p; if(!k){ alert('Elige una plantilla.'); return false; }
        let segs, fmt, fps;
        if(k==='custom'){
          const a=+$('#exFrom').value, b=+$('#exTo').value; if(!(b>=a)){ alert('"Hasta" debe ser mayor o igual que "Desde".'); return false; }
          segs=[{from:app.R?a:a-1,to:b}]; fmt=$('#exFmt').value; fps=+$('#exFps').value;
        } else { segs=P[k].segs(); fmt=P[k].fmt||stage.className; fps=P[k].fps; }
        const title=$('#exTitle').value.trim(); if(title && segs.length===1) segs[0].label=title;
        exportWith(segs,fmt,fps); }]]);
    $('#exFmt').value=stage.className;
    body.onclick=e=>{ const b=e.target.closest('.preset'); if(!b||b.disabled) return;
      body.querySelectorAll('.preset').forEach(x=>x.classList.toggle('on',x===b)); body.querySelector('.exc').hidden=b.dataset.p!=='custom'; };
    body.querySelector('.preset[data-p=yt]').click();
  };
}
