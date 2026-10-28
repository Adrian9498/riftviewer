// Generador de miniaturas para YouTube (1280×720).
// Las imágenes de cartas vienen de servidores que no dejan dibujarlas en un canvas para exportarlas,
// así que la miniatura se arma como una composición sobre la mesa y se captura de la pestaña,
// igual que un video: el navegador pide permiso y se guarda un solo fotograma como PNG.
import { $, ic, stage } from './base';
import { BR, BRIMG } from './brand';
import { cardByCode, setStatus } from './cards';
import { fit } from './fit';
import { needPremium } from './premium';
import { arr } from './replay';
import { G } from './script-engine';
import { DOC, setFmt, toast } from './shell';
import { app } from './state';
import { closeModal, esc, openModal, sleep } from './utils';

/** jugadores con su leyenda, color, puntos y si ganaron */
function players() {
  if (app.R) {
    const last = app.R.frames[app.R.frames.length - 1].state, win = new Set(last.gameOutcome?.winnerPlayerIds || []);
    return app.R.players.map(p => {
      const b = last.players.find(x => x.id === p.id)?.board || {}, leg = arr(b.legend)[0];
      return { name: p.name, col: p.col, score: b.score || 0, winner: win.has(p.id), img: leg ? cardByCode(leg.cardCode, leg.name, leg.imageUrl)?.img || '' : '', legend: leg?.name || '' };
    });
  }
  return [1, 2].map(o => {
    const leg = Object.values(G.cards).find(c => c.owner === o && c.zone === 'legend');
    return { name: G.players[o].name, col: `var(--p${o})`, score: G.players[o].pts, winner: false, img: leg?.data?.img || '', legend: leg?.name || '' };
  });
}

function compose(o) {
  const ps = players().slice(0, 2), logo = BRIMG.logo;
  $('#thumb').className = 'thumb ' + (stage.dataset.skin || 'fan');
  $('#thumb').innerHTML = `
    <div class="th-side l" style="--pc:${ps[0].col}${ps[0].img ? `;background-image:url('${ps[0].img}')` : ''}"></div>
    <div class="th-side r" style="--pc:${ps[1]?.col}${ps[1]?.img ? `;background-image:url('${ps[1].img}')` : ''}"></div>
    <div class="th-shade"></div>
    <div class="th-head">${o.title ? `<div class="th-title">${esc(o.title)}</div>` : ''}${o.sub ? `<div class="th-sub">${esc(o.sub)}</div>` : ''}</div>
    <div class="th-vs"><span>VS</span></div>
    ${ps.map((p, k) => `<div class="th-name ${k ? 'r' : 'l'}" style="--pc:${p.col}">
      ${o.winner && p.winner ? `<div class="th-win">${ic('crown')} Victoria</div>` : ''}
      <b>${esc(p.name)}</b>${p.legend ? `<small>${esc(p.legend)}</small>` : ''}
      ${o.score ? `<div class="th-score">${p.score}</div>` : ''}</div>`).join('')}
    ${o.brand && (logo || BR.name) ? `<div class="th-brand">${logo ? `<img src="${logo}">` : ''}${BR.name ? `<span>${esc(BR.name)}</span>` : ''}</div>` : ''}`;
}

async function capture(o) {
  if (!navigator.mediaDevices?.getDisplayMedia) { alert('Tu navegador no permite capturar la pantalla. Usa Chrome o Edge en la PC.'); return; }
  const prevFmt = stage.className; if (prevFmt !== 'h') setFmt('h');
  compose(o);
  let stream;
  try { stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude' }); }
  catch (e) { setStatus('Miniatura cancelada', 'err'); if (prevFmt !== 'h') setFmt(prevFmt); return; }
  const track = stream.getVideoTracks()[0];
  try { if (window.CropTarget && track.cropTo) await track.cropTo(await CropTarget.fromElement(stage)); } catch (e) {}
  // pantalla completa para capturar a buena resolución (requiere un clic del usuario)
  const sr = $('#startrec'), old = sr.innerHTML;
  sr.querySelector('h2').textContent = 'Todo listo para la miniatura';
  sr.querySelector('p').innerHTML = 'Al pulsar el botón, la pantalla se pondrá completa un momento y se guardará la imagen.';
  $('#bGo').textContent = 'Tomar miniatura';
  await new Promise(res => { sr.classList.add('show'); $('#bGo').onclick = async () => { sr.classList.remove('show'); try { await document.documentElement.requestFullscreen(); } catch (e) {} res(); }; });
  document.body.classList.add('rec', 'recording', 'thumbing'); await sleep(900); fit(); await sleep(700);
  try {
    const v = document.createElement('video'); v.muted = true; v.srcObject = stream; await v.play();
    await new Promise(r => v.readyState >= 2 ? r() : v.onloadeddata = r); await sleep(250);
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
    c.getContext('2d').drawImage(v, 0, 0, 1280, 720);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `miniatura-${(o.title || DOC.name || 'partida').replace(/[^\w-]+/g, '_').slice(0, 40)}.png`; a.click();
    toast('Miniatura guardada: ' + a.download, 'ok');
  } catch (e) { setStatus('No se pudo tomar la miniatura: ' + e.message, 'err'); }
  finally {
    track.stop();
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    document.body.classList.remove('rec', 'recording', 'thumbing'); sr.innerHTML = old;
    if (prevFmt !== 'h') setFmt(prevFmt); await sleep(200); fit();
  }
}

export function openThumbnail() {
  if (!DOC.kind) { toast('Abre primero un replay o un guion', 'err'); return; }
  if (!needPremium('thumbnail')) return;
  const ps = players();
  const body = openModal('Miniatura para YouTube', `
    <div class="full thprev"><div class="thscale"></div></div>
    <span>Título</span><input type="text" id="thTitle" value="${esc(ps.map(p => p.name).join(' vs '))}" maxlength="60">
    <span>Subtítulo</span><input type="text" id="thSub" placeholder="Opcional: Final regional · Mejor de 3" maxlength="60">
    <span>Mostrar</span><div class="thopts"><label><input type="checkbox" id="thScore" checked> Marcador</label><label><input type="checkbox" id="thWin" checked> Ganador</label><label><input type="checkbox" id="thBrand" checked> Tu marca</label></div>
    <div class="full hint">Se guarda como PNG de 1280×720. El navegador te pedirá compartir <b>esta pestaña</b>, igual que al exportar video.</div>`,
    [['Cancelar'], ['Guardar miniatura', 'primary', () => { const o = opts(); closeModal(); capture(o); return false; }]]);
  const opts = () => ({ title: $('#thTitle').value.trim(), sub: $('#thSub').value.trim(), score: $('#thScore').checked, winner: $('#thWin').checked, brand: $('#thBrand').checked });
  // vista previa: la misma composición, a escala, dentro de la ventana
  const preview = () => { compose(opts()); const p = body.querySelector('.thscale'); p.innerHTML = ''; p.style.setProperty('--k', body.querySelector('.thprev').clientWidth / 1920); const cl = $('#thumb').cloneNode(true); cl.id = ''; cl.classList.add('thumb', 'show'); p.appendChild(cl); };
  body.oninput = preview; preview();
}
