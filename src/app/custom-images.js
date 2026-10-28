// Generado a partir de legacy/app.js (sección "custom-images").
import { $, stage } from './base';
import { CUSTOM, IDB, setStatus } from './cards';
import { touchAsset } from './cloud-adapter';
import { nm } from './script-engine';
import { fileToDataURL, rerender } from './utils';

/* ================= 7. Imágenes para cartas faltantes ================= */
export let IMGTARGET=null;
export async function setCustomImage(key,file){
  try{ const url=await fileToDataURL(file,700); CUSTOM.set(key,url); await IDB.set(key,url).catch(()=>{}); touchAsset(key);
    setStatus('Imagen guardada. Se usará siempre para esta carta.','ok'); rerender(); }
  catch(err){ setStatus('No se pudo leer la imagen','err'); }
}

/** abre el selector de archivo para poner una imagen propia a una carta o campo */
export function pickImageFor(key){ IMGTARGET=key; $('#imgIn').click(); }
/** quita la imagen propia (vuelve la oficial, si existe) */
export async function removeCustomImage(key,name){
  CUSTOM.delete(key); await IDB.del(key).catch(()=>{}); touchAsset(key,true); setStatus(`Imagen propia de "${name}" eliminada`,'ok'); rerender();
}

export function init() {
  // el clic derecho lo atiende el menú de cartas (card-menu.js), que usa pickImageFor y removeCustomImage
  $('#imgIn').onchange=async e=>{ const f=e.target.files[0]; e.target.value=''; if(f&&IMGTARGET) await setCustomImage(IMGTARGET,f); };
  stage.addEventListener('dragover',e=>{ if(e.target.closest('[data-ikey]')){ e.preventDefault(); e.dataTransfer.dropEffect='copy'; } });
  stage.addEventListener('drop',async e=>{ const t=e.target.closest('[data-ikey]'), f=e.dataTransfer.files[0];
    if(!t||!f||!f.type.startsWith('image/')) return; e.preventDefault(); await setCustomImage(t.dataset.ikey,f); });
}
