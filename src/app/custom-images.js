// Generado a partir de legacy/app.js (sección "custom-images").
import { $, stage } from './base';
import { CUSTOM, IDB, setStatus } from './cards';
import { touchAsset } from './cloud-adapter';
import { REC } from './export';
import { nm } from './script-engine';
import { fileToDataURL, rerender } from './utils';

/* ================= 7. Imágenes para cartas faltantes ================= */
export let IMGTARGET=null;
export async function setCustomImage(key,file){
  try{ const url=await fileToDataURL(file,700); CUSTOM.set(key,url); await IDB.set(key,url).catch(()=>{}); touchAsset(key);
    setStatus('Imagen guardada. Se usará siempre para esta carta.','ok'); rerender(); }
  catch(err){ setStatus('No se pudo leer la imagen','err'); }
}

export function init() {
  stage.addEventListener('contextmenu',async e=>{
    if(REC.on) return; const t=e.target.closest('[data-ikey]'); if(!t) return; e.preventDefault();
    const key=t.dataset.ikey, nm=t.dataset.iname||'esta carta';
    // si ya tiene una imagen propia, ofrecer quitarla (vuelve la imagen oficial, si existe)
    if(CUSTOM.has(key) && confirm(`"${nm}" tiene una imagen que subiste tú.\n\nAceptar: quitarla y usar la imagen oficial.\nCancelar: elegir otra imagen.`)){
      CUSTOM.delete(key); await IDB.del(key).catch(()=>{}); touchAsset(key,true); setStatus(`Imagen propia de "${nm}" eliminada`,'ok'); rerender(); return; }
    IMGTARGET=key; $('#imgIn').click();
  });
  $('#imgIn').onchange=async e=>{ const f=e.target.files[0]; e.target.value=''; if(f&&IMGTARGET) await setCustomImage(IMGTARGET,f); };
  stage.addEventListener('dragover',e=>{ if(e.target.closest('[data-ikey]')){ e.preventDefault(); e.dataTransfer.dropEffect='copy'; } });
  stage.addEventListener('drop',async e=>{ const t=e.target.closest('[data-ikey]'), f=e.dataTransfer.files[0];
    if(!t||!f||!f.type.startsWith('image/')) return; e.preventDefault(); await setCustomImage(t.dataset.ikey,f); });
}
