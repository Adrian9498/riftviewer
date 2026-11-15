// Captura de un elemento de la página como imagen PNG.
// Las imágenes de cartas vienen de servidores que no dejan dibujarlas en un canvas para exportarlas,
// así que se captura la pestaña (el navegador pide permiso, como al grabar video) y se guarda un fotograma.
import { $ } from './base';
import { setStatus } from './cards';
import { toast } from './shell';
import { sleep } from './utils';

/**
 * show(): muestra lo que se va a capturar y devuelve el elemento; hide(): lo quita.
 * Se recorta la captura a ese elemento y se guarda a w×h.
 */
export async function captureToPng({ show, hide, w, h, file, title, msg }) {
  if (!navigator.mediaDevices?.getDisplayMedia) { alert('Tu navegador no permite capturar la pantalla. Usa Chrome o Edge en la PC.'); return false; }
  let stream;
  try { stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude' }); }
  catch (e) { setStatus('Captura cancelada', 'err'); return false; }
  const track = stream.getVideoTracks()[0];
  // pantalla completa para capturar a buena resolución (el navegador lo exige tras un clic del usuario)
  const sr = $('#startrec'), old = sr.innerHTML;
  sr.querySelector('h2').textContent = title;
  sr.querySelector('p').innerHTML = msg;
  $('#bGo').textContent = 'Tomar imagen';
  await new Promise(res => { sr.classList.add('show'); $('#bGo').onclick = async () => { sr.classList.remove('show'); try { await document.documentElement.requestFullscreen(); } catch (e) {} res(); }; });
  try {
    const el = show(); await sleep(700);
    let cropped = false;
    try { if (window.CropTarget && track.cropTo) { await track.cropTo(await CropTarget.fromElement(el)); cropped = true; } } catch (e) {}
    await sleep(500);
    const v = document.createElement('video'); v.muted = true; v.srcObject = stream; await v.play();
    await new Promise(r => v.readyState >= 2 ? r() : v.onloadeddata = r); await sleep(250);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    if (cropped) c.getContext('2d').drawImage(v, 0, 0, w, h);
    else {
      // sin recorte del navegador llega la pestaña entera: se recorta a mano el rectángulo del elemento
      // (si no, la pestaña completa se estira a w×h y la imagen sale corrida y deformada)
      const r = el.getBoundingClientRect(), kx = v.videoWidth / innerWidth, ky = v.videoHeight / innerHeight;
      c.getContext('2d').drawImage(v, r.left * kx, r.top * ky, r.width * kx, r.height * ky, 0, 0, w, h);
    }
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file; a.click();
    toast('Imagen guardada: ' + file, 'ok');
    return true;
  } catch (e) { setStatus('No se pudo tomar la imagen: ' + e.message, 'err'); return false; }
  finally {
    track.stop(); hide();
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    sr.innerHTML = old;
  }
}
