// Generado a partir de legacy/app.js (sección "sounds").
import { noteLocalChange } from '../cloud/sync';
import { $, ic } from './base';
import { touchAsset } from './cloud-adapter';
import { IDB, setStatus } from './cards';

/* ================= Sonidos: batalla, conquista y punto ================= */
export let SND={on:true,vol:70,style:'epico',ev:{battle:true,conquest:true,point:true}};
export const SND_NAMES={battle:'⚔ Inicio de batalla en un campo',conquest:'🏳 Conquista',point:'⭐ Punto ganado (hold o conquista)'};
export const SFX={ctx:null,master:null,dest:null,blobs:{},bufs:{},
  ensure(){
    if(!this.ctx){ const C=window.AudioContext||window.webkitAudioContext; if(!C) return null;
      this.ctx=new C(); this.master=this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.dest=this.ctx.createMediaStreamDestination(); this.master.connect(this.dest); this.setVol();
      for(const k in this.blobs) this.decode(k); }
    if(this.ctx.state==='suspended') this.ctx.resume().catch(()=>{});
    return this.ctx;
  },
  setVol(){ if(this.master) this.master.gain.value=SND.on?SND.vol/100:0; },
  async decode(k){ try{ this.bufs[k]=await this.ctx.decodeAudioData(await this.blobs[k].arrayBuffer()); }catch(e){ delete this.bufs[k]; setStatus('No se pudo leer el audio de '+SND_NAMES[k],'err'); } },
  play(kind,force){
    if(!force && (!SND.on || !SND.ev[kind])) return; const ctx=this.ensure(); if(!ctx) return;
    if(this.bufs[kind]){ const s=ctx.createBufferSource(); s.buffer=this.bufs[kind]; s.connect(this.master); s.start(); return; }
    (SND.style==='clasico'?SYN:SYN_EPIC)[kind](ctx,this.master,ctx.currentTime+0.02);
  }
};
export function tone(ctx,out,{type='sine',f,t,dur,vol=.3,att=.01,f2,cut}){
  const o=ctx.createOscillator(), g=ctx.createGain(); o.type=type; o.frequency.setValueAtTime(f,t);
  if(f2) o.frequency.exponentialRampToValueAtTime(f2,t+dur);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+att); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  let n=o; if(cut){ const fl=ctx.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=cut; o.connect(fl); n=fl; }
  n.connect(g).connect(out); o.start(t); o.stop(t+dur+0.05);
}
export function noise(ctx,out,{t,dur,vol=.4,type='bandpass',freq=2000,q=.8}){
  const len=Math.ceil(ctx.sampleRate*dur), b=ctx.createBuffer(1,len,ctx.sampleRate), d=b.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
  const s=ctx.createBufferSource(), fl=ctx.createBiquadFilter(), g=ctx.createGain(); s.buffer=b; fl.type=type; fl.frequency.value=freq; fl.Q.value=q;
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); s.connect(fl).connect(g).connect(out); s.start(t);
}
export const SYN={
  // dos golpes de tambor grave con choque metálico
  battle(ctx,out,t){
    for(const [dt,v] of [[0,1],[0.2,.75]]){
      tone(ctx,out,{f:150,f2:42,t:t+dt,dur:.5,vol:.6*v,att:.005});
      noise(ctx,out,{t:t+dt,dur:.28,vol:.4*v,freq:2600,q:.7});
      tone(ctx,out,{type:'square',f:523,t:t+dt,dur:.22,vol:.07*v,att:.002,cut:3500});
      tone(ctx,out,{type:'square',f:787,t:t+dt,dur:.18,vol:.05*v,att:.002,cut:4000}); }
  },
  // fanfarria: arpegio ascendente y acorde final
  conquest(ctx,out,t){
    [392,523.25,659.25].forEach((f,k)=>tone(ctx,out,{type:'sawtooth',f,t:t+k*.11,dur:.22,vol:.16,att:.015,cut:2400}));
    [523.25,659.25,783.99,1046.5].forEach(f=>tone(ctx,out,{type:'sawtooth',f,t:t+.34,dur:1.1,vol:.11,att:.03,cut:2600}));
    tone(ctx,out,{f:130.8,t:t+.34,dur:1.1,vol:.35,att:.02});
    noise(ctx,out,{t:t+.34,dur:.5,vol:.18,type:'highpass',freq:6000,q:.5});
  },
  // campanita brillante, tipo moneda
  point(ctx,out,t){
    tone(ctx,out,{f:1318.5,t,dur:.35,vol:.22,att:.004});
    tone(ctx,out,{f:1760,t:t+.09,dur:.7,vol:.25,att:.004});
    tone(ctx,out,{type:'triangle',f:3520,t:t+.09,dur:.4,vol:.05,att:.004});
  }
};
// estilo épico, inspirado en los juegos de batalla en línea: cuernos, tambores de guerra, impactos y monedas
export function swell(ctx,out,{f,t,dur,vol,from=300,to=2400,type='sawtooth'}){
  const o=ctx.createOscillator(), fl=ctx.createBiquadFilter(), g=ctx.createGain();
  o.type=type; o.frequency.value=f; fl.type='lowpass'; fl.frequency.setValueAtTime(from,t); fl.frequency.exponentialRampToValueAtTime(to,t+dur*0.6);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+dur*0.35); g.gain.setValueAtTime(vol,t+dur*0.7); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(fl).connect(g).connect(out); o.start(t); o.stop(t+dur+0.05);
}
export function drum(ctx,out,t,v=1){
  tone(ctx,out,{f:110,f2:38,t,dur:.45,vol:.55*v,att:.004});
  noise(ctx,out,{t,dur:.12,vol:.25*v,type:'lowpass',freq:900,q:.7});
}
export const SYN_EPIC={
  // cuerno de guerra grave con tambores y un "whoosh" que sube
  battle(ctx,out,t){
    noise(ctx,out,{t,dur:.55,vol:.12,type:'bandpass',freq:700,q:.6});
    [[0,1],[.16,.7],[.32,1]].forEach(([dt,v])=>drum(ctx,out,t+dt,v));
    for(const [f,v] of [[98,.14],[147,.10],[196,.06]]) swell(ctx,out,{f,t:t+.3,dur:1.3,vol:v,from:250,to:1800});
    swell(ctx,out,{f:98.5,t:t+.3,dur:1.3,vol:.08,from:250,to:1600});
  },
  // impacto profundo (como derribar una torre) y acorde heroico de metales
  conquest(ctx,out,t){
    tone(ctx,out,{f:70,f2:28,t,dur:.9,vol:.6,att:.003});
    noise(ctx,out,{t,dur:.7,vol:.3,type:'lowpass',freq:500,q:.5});
    noise(ctx,out,{t,dur:.25,vol:.16,type:'bandpass',freq:2200,q:.8});
    const c=t+.22;
    for(const [f,v] of [[261.6,.11],[329.6,.08],[392,.08],[523.3,.07],[130.8,.12]]) swell(ctx,out,{f,t:c,dur:1.6,vol:v,from:400,to:3200});
    [1568,2093,2637,3136].forEach((f,k)=>tone(ctx,out,{type:'triangle',f,t:c+.25+k*.06,dur:.9,vol:.03,att:.005}));
  },
  // monedas de oro: tintineo metálico rápido con brillo
  point(ctx,out,t){
    [[2637,0],[3136,.05],[3951,.1],[3136,.16],[3951,.21]].forEach(([f,dt],k)=>{
      tone(ctx,out,{type:'triangle',f,t:t+dt,dur:.5-k*.04,vol:.14,att:.002});
      tone(ctx,out,{f:f*2.76,t:t+dt,dur:.18,vol:.03,att:.002}); });
    noise(ctx,out,{t,dur:.35,vol:.06,type:'highpass',freq:7000,q:.5});
  }
};
export function saveSnd(){ try{ localStorage.setItem('rb_snd',JSON.stringify(SND)); }catch(e){} SFX.setVol();
  // si cambia desde fuera (la nube), se redibuja; mientras el usuario mueve un control, no
  if($('#insSnd') && !$('#insSnd').contains(document.activeElement)) openSounds(); }
export let SNDTARGET=null;
/* Sonido vive en el inspector de Ajustes (sección "Sonido") */
export function openSounds(){
  const body=$('#insSnd'); body.innerHTML=`
    <span>Sonidos</span><select id="sOn"><option value="1">Activados</option><option value="0">Desactivados</option></select>
    <span>Volumen</span><input type="range" id="sVol" min="0" max="100" value="${SND.vol}">
    <span>Estilo</span><select id="sStyle"><option value="epico">Épico (cuernos, tambores, monedas)</option><option value="clasico">Clásico (suave)</option></select>
    ${Object.keys(SND_NAMES).map(k=>`<span><label><input type="checkbox" data-ev="${k}" ${SND.ev[k]?'checked':''}> ${SND_NAMES[k]}</label></span>
      <div><button class="btn mini ico" data-test="${k}" title="Probar">${ic('play')}</button> <button class="btn mini" data-up="${k}">Mi audio</button>${SFX.blobs[k]?` <button class="btn mini" data-rm="${k}">Quitar el mío</button> <small style="color:var(--ok)">● propio</small>`:''}</div>`).join('')}
    <div class="full hint">Los sonidos también quedan grabados al <b>exportar video</b>. Puedes reemplazar cualquiera por un audio tuyo (MP3, WAV, OGG).</div>`;
  $('#sOn').value=SND.on?'1':'0'; $('#sStyle').value=SND.style||'epico';
}
function bindSounds(body){
  body.oninput=e=>{ const t=e.target;
    if(t.id==='sOn') SND.on=t.value==='1'; if(t.id==='sStyle') SND.style=t.value; if(t.id==='sVol') SND.vol=+t.value; if(t.dataset.ev) SND.ev[t.dataset.ev]=t.checked; saveSnd(); noteLocalChange('settings'); };
  body.onclick=async e=>{ const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.test) SFX.play(b.dataset.test,true);
    if(b.dataset.up){ SNDTARGET=b.dataset.up; $('#sndIn').click(); }
    if(b.dataset.rm){ delete SFX.blobs[b.dataset.rm]; delete SFX.bufs[b.dataset.rm]; await IDB.del('snd:'+b.dataset.rm).catch(()=>{}); touchAsset('snd:'+b.dataset.rm,true); openSounds(); } };
}

export function init() {
  try{ const s=JSON.parse(localStorage.getItem('rb_snd')||'null'); if(s) SND={...SND,...s,ev:{...SND.ev,...s.ev}}; }catch(e){}
  // el navegador solo deja sonar audio después de un clic o tecla del usuario
  ['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,()=>{ if(SFX.ctx||SND.on) SFX.ensure(); },true));
  bindSounds($('#insSnd')); openSounds();
  $('#sndIn').onchange=async e=>{
    const f=e.target.files[0]; e.target.value=''; if(!f||!SNDTARGET) return;
    if(f.size>3*1048576){ alert('El audio es muy pesado (máximo 3 MB). Usa un clip corto.'); return; }
    SFX.blobs[SNDTARGET]=f; await IDB.set('snd:'+SNDTARGET,f).catch(()=>{}); touchAsset('snd:'+SNDTARGET); SFX.ensure(); await SFX.decode(SNDTARGET);
    SFX.play(SNDTARGET,true); openSounds();
  };
}
