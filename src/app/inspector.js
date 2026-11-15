// Inspector de Ajustes (panel derecho): se abre y cierra desde la barra superior y recuerda qué secciones dejaste abiertas.
import { $, isPhone } from './base';
import { renderBrandPanels } from './brand';
import { fit } from './fit';

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

export function setInspector(open) {
  document.body.classList.toggle('noinsp', !open);
  // en el teléfono Ajustes es una hoja: abrirla cierra el panel de jugadas
  if (open && isPhone()) { document.body.classList.add('nopanel'); $('#bPanel').classList.remove('on'); }
  $('#bSettings').classList.toggle('on', open);
  write('rb_insp', open);
  fit();
}
export const toggleInspector = () => setInspector(document.body.classList.contains('noinsp'));
/** abre el inspector en una sección (por ejemplo desde un aviso de "cámbialo en Ajustes") */
export function openSection(name) {
  setInspector(true);
  const d = $(`#inspector .isec[data-s="${name}"]`); if (!d) return;
  d.open = true; d.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

export function init() {
  // flota sobre la mesa: empieza cerrado salvo que lo hayas dejado abierto
  setInspector(read('rb_insp', false));
  $('#bSettings').onclick = toggleInspector;
  $('#bInspX').onclick = () => setInspector(false);
  // Esc lo cierra, salvo que haya una ventana abierta o estés eligiendo cartas
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || document.body.classList.contains('noinsp') || document.body.classList.contains('picking') || $('#modal').classList.contains('show')) return;
    setInspector(false);
  });
  const open = read('rb_isec', ['look']);
  document.querySelectorAll('#inspector .isec').forEach(d => {
    d.open = open.includes(d.dataset.s);
    d.addEventListener('toggle', () => {
      write('rb_isec', [...document.querySelectorAll('#inspector .isec')].filter(x => x.open).map(x => x.dataset.s));
      if (d.open && d.dataset.s === 'brand') renderBrandPanels();   // el número de imágenes propias pudo cambiar
    });
  });
}
