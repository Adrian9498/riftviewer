// Descarga el catálogo de cartas de OpenRift (openrift.app) a public/openrift-catalog.json.
// Uso: npm run catalogo   (ejecútalo cuando salga un set nuevo)
import { writeFile, mkdir } from 'node:fs/promises';

const URL_CATALOGO = 'https://openrift.app/api/v1/catalog?langs=EN';
const destino = new URL('../public/openrift-catalog.json', import.meta.url);

console.log('Descargando catálogo de OpenRift…');
const res = await fetch(URL_CATALOGO, { headers: { 'User-Agent': 'RiftboundReplayVisualizer/1.0 (personal project)' } });
if (!res.ok) {
  console.error(`No se pudo descargar el catálogo (HTTP ${res.status}). Revisa tu conexión e inténtalo de nuevo.`);
  process.exit(1);
}
const texto = await res.text();
const cat = JSON.parse(texto);
if (!cat.printings) {
  console.error('La respuesta no parece el catálogo de OpenRift.');
  process.exit(1);
}
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await writeFile(destino, texto);
console.log(`Listo: ${Object.keys(cat.printings).length} impresiones guardadas en public/openrift-catalog.json`);
