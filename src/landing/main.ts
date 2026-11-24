import { mountAds } from '../ads/ads';
import { startVisits } from '../stats/visits';

// Página informativa: barra que se vuelve sólida al bajar, aparición de secciones al hacer scroll
// y el brillo de las tarjetas que sigue al ratón.

const nav = document.getElementById('lnav');
const onScroll = () => nav?.classList.toggle('solid', scrollY > 24);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// las secciones aparecen al entrar en pantalla (sin IntersectionObserver se muestran de una vez)
const items = document.querySelectorAll<HTMLElement>('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  items.forEach(el => io.observe(el));
} else items.forEach(el => el.classList.add('in'));

// brillo que sigue al ratón en las tarjetas de funciones
document.querySelectorAll<HTMLElement>('.fcard').forEach(card => {
  card.addEventListener('pointermove', e => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
});

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());

// lugares que quedan en la beta abierta (beta_estado en Supabase, con la clave pública): sin conexión se queda el texto fijo
const SB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined, SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
if (SB_URL && SB_KEY) {
  fetch(`${SB_URL}/rest/v1/rpc/beta_estado`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' }, body: '{}' })
    .then(r => r.ok ? r.json() : null)
    .then((st: { cerrada?: boolean; cupo?: number | null; lugares?: number | null } | null) => {
      if (!st || st.cerrada || st.cupo == null || st.lugares == null) return;
      const left = Math.max(0, st.lugares), short = left ? `quedan ${left} de ${st.cupo} lugares` : 'lugares llenos';
      document.querySelectorAll<HTMLElement>('[data-lugares]').forEach(el => { el.textContent = short; });
      document.querySelectorAll<HTMLElement>('[data-lugares-full]').forEach(el => {
        el.textContent = left ? `Quedan ${left} de ${st.cupo} lugares.` : `Ya se llenaron los ${st.cupo} lugares: si ya tienes cuenta, entra.`;
        el.hidden = false;
      });
    })
    .catch(() => {});
}

// anuncios (solo si AdSense está configurado)
mountAds();

// contador de visitas (solo si GoatCounter está configurado)
startVisits();
