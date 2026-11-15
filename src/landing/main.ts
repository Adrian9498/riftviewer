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
