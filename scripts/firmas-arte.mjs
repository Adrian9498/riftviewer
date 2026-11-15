// Calcula la huella del arte de cada carta y versión (normal, arte alterno,
// sobrenumerada, firmada…) y la guarda en public/art-sigs.json. El escáner la usa para elegir la versión sola.
// Uso: npm run catalogo (corre después de descargar el catálogo) o node scripts/firmas-arte.mjs
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { artSignature, sigToB64 } from '../src/collection/artsig.ts';

const raiz = new URL('../public/', import.meta.url);
const cat = JSON.parse(await readFile(new URL('openrift-catalog.json', raiz), 'utf8'));
const destino = new URL('art-sigs.json', raiz);

// una imagen por código (la de acabado normal si hay), y los grupos de códigos con el mismo número
const img = new Map(), grupos = new Map();
for (const p of Object.values(cat.printings || {})) {
  if (p.language && p.language !== 'EN') continue;
  const code = (p.shortCode || '').toUpperCase(), id = p.images?.[0]?.imageId;
  const m = code.match(/^([A-Z0-9]+)-(SP|R|T)?(\d+)/);
  if (!m || !id) continue;
  if (!img.has(code) || p.finish === 'normal') img.set(code, id);
  const k = m[1] + (m[2] || '') + +m[3];
  if (!grupos.has(k)) grupos.set(k, new Set());
  grupos.get(k).add(code);
}
// todas las cartas: además de elegir la versión, el arte confirma el número cuando el OCR confunde cifras (3 por 8…)
const codigos = [...grupos.values()].flatMap(g => [...g]);

let previas = {};
try { previas = JSON.parse(await readFile(destino, 'utf8')); } catch { /* primera vez */ }
const out = { v: 2, ids: {}, sigs: {} };
let hechas = 0, nuevas = 0, fallas = 0;
async function una(code) {
  const id = img.get(code);
  // si la imagen no cambió, se reusa la huella anterior
  if (previas.v === 2 && previas.ids?.[code] === id && previas.sigs?.[code]) { out.ids[code] = id; out.sigs[code] = previas.sigs[code]; hechas++; return; }
  try {
    const res = await fetch(`https://openrift.app/media/cards/${id}-400w.webp`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    out.ids[code] = id; out.sigs[code] = sigToB64(artSignature(data, info.width, info.height));
    hechas++; nuevas++;
  } catch (e) { fallas++; console.warn(`  ${code}: ${e.message}`); }
}
console.log(`Huellas de arte: ${codigos.length} cartas y versiones…`);
const cola = [...codigos];
await Promise.all(Array.from({ length: 8 }, async () => { while (cola.length) await una(cola.shift()); }));
await writeFile(destino, JSON.stringify(out));
console.log(`Listo: ${hechas} huellas (${nuevas} nuevas${fallas ? `, ${fallas} fallaron` : ''}) en public/art-sigs.json`);
