// Inspector de Ajustes (panel derecho): se abre y cierra desde la barra superior y recuerda qué secciones dejaste abiertas.
import { $ } from './base';
import { renderBrandPanels } from './brand';
import { fit } from './fit';

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

export function setInspector(open) {
  document.body.classList.toggle('noinsp', !open);
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
  // abierto por defecto solo si hay espacio de sobra para la mesa
  setInspector(read('rb_insp', innerWidth >= 1500));
  $('#bSettings').onclick = toggleInspector;
  $('#bInspX').onclick = () => setInspector(false);
  const open = read('rb_isec', ['look']);
  document.querySelectorAll('#inspector .isec').forEach(d => {
    d.open = open.includes(d.dataset.s);
    d.addEventListener('toggle', () => {
      write('rb_isec', [...document.querySelectorAll('#inspector .isec')].filter(x => x.open).map(x => x.dataset.s));
      if (d.open && d.dataset.s === 'brand') renderBrandPanels();   // el número de imágenes propias pudo cambiar
    });
  });
}
