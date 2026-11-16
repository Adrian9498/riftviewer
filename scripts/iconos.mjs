// Genera el ícono de Riftviewer (favicon, ícono de iPhone y Android) y la imagen para redes (Open Graph, 1200×630)
// en public/. El emblema es la partícula "magic-03" de Kenney (CC0) pintada de dorado.
// Uso: node scripts/iconos.mjs   (solo hace falta volver a correrlo si cambia el diseño)
import sharp from 'sharp';

const raiz = new URL('../', import.meta.url);
const pub = f => new URL('public/' + f, raiz).pathname.replace(/^\/([A-Z]:)/, '$1');
const emblema = new URL('src/assets/fx/magic-03.png', raiz).pathname.replace(/^\/([A-Z]:)/, '$1');

/** El emblema dorado a un tamaño (la partícula blanca recorta un degradado dorado). */
async function emblemaDorado(size) {
  const oro = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4cf"/><stop offset=".5" stop-color="#e6c67f"/><stop offset="1" stop-color="#9a7633"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/></svg>`);
  // dest-in: queda el dorado solo donde la partícula no es transparente
  const particula = await sharp(emblema).resize(size, size).png().toBuffer();
  return sharp(oro).composite([{ input: particula, blend: 'dest-in' }]).png().toBuffer();
}

/** Ícono cuadrado: fondo azul noche con borde dorado y el emblema al centro. */
async function icono(size, file, { redondo = true } = {}) {
  const r = redondo ? Math.round(size * 0.22) : 0, b = Math.max(1, Math.round(size / 48));
  const fondo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><radialGradient id="f" cx=".5" cy=".38" r=".75"><stop offset="0" stop-color="#1f3358"/><stop offset="1" stop-color="#070b14"/></radialGradient></defs>
    <rect x="${b / 2}" y="${b / 2}" width="${size - b}" height="${size - b}" rx="${r}" fill="url(#f)" stroke="#c8aa6e" stroke-width="${b}"/></svg>`);
  const e = Math.round(size * 0.78);
  await sharp(fondo).composite([{ input: await emblemaDorado(e), left: Math.round((size - e) / 2), top: Math.round((size - e) / 2) }]).png().toFile(pub(file));
}

/** Imagen para redes (Open Graph / Twitter): 1200×630. */
async function imagenRedes() {
  const W = 1200, H = 630;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <radialGradient id="a" cx=".22" cy=".3" r=".7"><stop offset="0" stop-color="#1d4c8f" stop-opacity=".9"/><stop offset="1" stop-color="#070b14" stop-opacity="0"/></radialGradient>
      <radialGradient id="b" cx=".85" cy=".9" r=".6"><stop offset="0" stop-color="#8a5a1c" stop-opacity=".8"/><stop offset="1" stop-color="#070b14" stop-opacity="0"/></radialGradient>
      <linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4cf"/><stop offset=".55" stop-color="#e6c67f"/><stop offset="1" stop-color="#9a7633"/></linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="#070b14"/><rect width="${W}" height="${H}" fill="url(#a)"/><rect width="${W}" height="${H}" fill="url(#b)"/>
    <rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="26" fill="none" stroke="#c8aa6e" stroke-opacity=".55" stroke-width="2"/>
    <text x="430" y="250" font-family="Cinzel, Georgia, 'Times New Roman', serif" font-weight="900" font-size="104" letter-spacing="4" fill="url(#t)">Riftviewer</text>
    <text x="434" y="318" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="36" fill="#e8edf7">Replays, mazos y colección</text>
    <text x="434" y="364" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="36" fill="#e8edf7">para Riftbound</text>
    <g font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="24" fill="#c5cee0">
      <text x="434" y="452">✦ Replays a video 16:9 y 9:16</text>
      <text x="434" y="492">✦ Constructor de mazos con reglas</text>
      <text x="434" y="532">✦ Escáner de cartas y precios diarios</text>
    </g>
    <text x="${W - 50}" y="${H - 46}" text-anchor="end" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="24" font-weight="600" fill="#e6c67f">riftviewer.com</text>
  </svg>`);
  const e = 340;
  await sharp(svg).composite([{ input: await emblemaDorado(e), left: 60, top: Math.round((H - e) / 2) }]).png({ compressionLevel: 9 }).toFile(pub('og-image.png'));
}

await icono(32, 'favicon-32.png');
await icono(180, 'apple-touch-icon.png', { redondo: false });   // iOS redondea solo
await icono(192, 'icon-192.png');
await icono(512, 'icon-512.png');
await imagenRedes();
console.log('Listo: favicon-32.png, apple-touch-icon.png, icon-192.png, icon-512.png y og-image.png en public/');
