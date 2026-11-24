// Anuncios de Google AdSense en lugares discretos (landing, inicio de la app y carpeta pública).
// Nunca dentro de la mesa animada ni en los videos que exportas.
// Se configuran con dos variables de compilación (públicas, van en la página):
//   VITE_ADSENSE_CLIENT  el id del editor, "ca-pub-1234567890123456"
//   VITE_ADSENSE_SLOT    el id del bloque de anuncio (adaptable) creado en AdSense
// Sin ellas no se carga nada de Google y los espacios quedan ocultos.

const CLIENT = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined)?.trim() || '';
const SLOT = (import.meta.env.VITE_ADSENSE_SLOT as string | undefined)?.trim() || '';

/** ¿Hay anuncios configurados? */
export const adsEnabled = (client = CLIENT, slot = SLOT) => /^ca-pub-\d{10,20}$/.test(client) && /^\d{6,12}$/.test(slot);

let loading = false;
function loadScript(client: string) {
  if (loading || typeof document === 'undefined') return;
  loading = true;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(s);
}

/**
 * Pone un anuncio adaptable dentro de `box` (un elemento con la clase "adbox", oculto al inicio).
 * Una sola vez por espacio. Devuelve true si lo puso.
 */
export function mountAd(box: HTMLElement | null, client = CLIENT, slot = SLOT): boolean {
  if (!box || box.dataset.adOn || !adsEnabled(client, slot)) return false;
  box.dataset.adOn = '1';
  box.innerHTML = `<span class="adlbl">Publicidad</span><ins class="adsbygoogle" style="display:block" data-ad-client="${client}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
  box.hidden = false;
  loadScript(client);
  try { ((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle ||= []).push({}); } catch { /* sin anuncio: queda el espacio vacío */ }
  return true;
}

/** Pone anuncios en todos los espacios ".adbox" de la página que estén a la vista. */
export function mountAds(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.adbox').forEach(b => {
    // un espacio dentro de algo oculto se llena cuando aparezca (AdSense no llena espacios sin ancho)
    if (b.parentElement?.closest('[hidden]')) return;
    mountAd(b);
  });
}
