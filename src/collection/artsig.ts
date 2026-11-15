// Huella del arte de una carta, para distinguir versiones con el mismo número (normal, arte alterno, sobrenumerada…)
// sin depender del OCR. Es el color promedio en una cuadrícula chica sobre la ilustración, normalizado por canal:
// así no le afectan el brillo, el contraste ni el tono de la luz de la cámara.
// Las huellas del catálogo se calculan una vez (scripts/firmas-arte.mjs → public/art-sigs.json) porque el navegador
// no puede leer los píxeles de las imágenes de OpenRift (no mandan permisos CORS).

/** Zona de la carta que se usa (fracciones del ancho y del alto): la ilustración, sin bordes ni texto. */
export const ART = { x0: 0.08, x1: 0.92, y0: 0.07, y1: 0.5, cols: 12, rows: 8 };
const N = ART.cols * ART.rows;

/**
 * Huella de una carta completa en RGBA (cualquier tamaño). Devuelve 3·cols·rows valores en -127..127.
 * (ox, oy, cw, ch): rectángulo de la carta dentro de la imagen; por defecto, toda la imagen.
 */
export function artSignature(rgba: ArrayLike<number>, w: number, h: number, ox = 0, oy = 0, cw = w, ch = h): Int8Array {
  const sum = new Float64Array(N * 3), cnt = new Float64Array(N);
  const ax0 = ox + cw * ART.x0, ay0 = oy + ch * ART.y0, aw = cw * (ART.x1 - ART.x0), ah = ch * (ART.y1 - ART.y0);
  const xs = Math.max(0, Math.floor(ax0)), xe = Math.min(w, Math.ceil(ax0 + aw)), ys = Math.max(0, Math.floor(ay0)), ye = Math.min(h, Math.ceil(ay0 + ah));
  for (let y = ys; y < ye; y++) {
    const r = Math.floor((y + 0.5 - ay0) / ah * ART.rows); if (r < 0 || r >= ART.rows) continue;
    for (let x = xs; x < xe; x++) {
      const c = Math.floor((x + 0.5 - ax0) / aw * ART.cols); if (c < 0 || c >= ART.cols) continue;
      const k = (y * w + x) * 4, cell = r * ART.cols + c;
      sum[cell * 3] += rgba[k]; sum[cell * 3 + 1] += rgba[k + 1]; sum[cell * 3 + 2] += rgba[k + 2]; cnt[cell]++;
    }
  }
  const out = new Int8Array(N * 3);
  for (let ch3 = 0; ch3 < 3; ch3++) {
    const v = new Float64Array(N);
    for (let i = 0; i < N; i++) v[i] = cnt[i] ? sum[i * 3 + ch3] / cnt[i] : 0;
    let m = 0; for (const x of v) m += x; m /= N;
    let s = 0; for (const x of v) s += (x - m) ** 2; s = Math.sqrt(s / N) || 1;
    for (let i = 0; i < N; i++) out[i * 3 + ch3] = Math.max(-127, Math.min(127, Math.round((v[i] - m) / s * 40)));
  }
  return out;
}

/** Parecido entre dos huellas: 1 = iguales, 0 = nada que ver. */
export function artSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (!a || !b || a.length !== b.length) return 0;
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

export const sigToB64 = (s: Int8Array) => btoa(String.fromCharCode(...new Uint8Array(s.buffer, s.byteOffset, s.length)));
export function sigFromB64(b: string): Int8Array {
  const raw = atob(b), out = new Int8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i) << 24 >> 24;
  return out;
}

/** Para buscar en todo el set: parecido mínimo, y ventaja sobre la mejor carta de otro número. */
export const SEARCH = { min: 0.8, margin: 0.15 };
/**
 * Respaldo cuando el arte no se parece a la carta leída ni a sus parecidas (el OCR confundió una cifra que no
 * está en la tabla): la carta de todo el set con el arte claramente más parecido. group: el número sin la versión,
 * para no contar como rivales a las versiones con el mismo arte (normal y firmada).
 */
export function findByArt(cam: ArrayLike<number>, cands: { code: string; group: string; sig?: ArrayLike<number> | null }[]): { code: string; score: number } | null {
  const scored = cands.filter(c => c.sig).map(c => ({ ...c, score: artSimilarity(cam, c.sig!) })).sort((a, b) => b.score - a.score);
  const best = scored[0]; if (!best || best.score < SEARCH.min) return null;
  const rival = scored.find(s => s.group !== best.group);
  if (rival && best.score - rival.score < SEARCH.margin) return null;
  // entre versiones del mismo número con el mismo arte, la más común
  const twin = scored.filter(s => s.group === best.group && best.score - s.score < PICK.margin / 2)
    .sort((a, b) => a.code.length - b.code.length || a.code.localeCompare(b.code))[0];
  return { code: twin.code, score: twin.score };
}

/** Cuánto tiene que ganar una versión para cambiar la que dijo el OCR, y el parecido mínimo para creerle. */
export const PICK = { min: 0.55, margin: 0.08 };
/**
 * Elige entre versiones del mismo número la que más se parece a lo que ve la cámara.
 * Devuelve el código elegido, o null si no hay con qué decidir (sin huellas, o todas se parecen igual: mismo arte).
 * prefer: lo que leyó el OCR; solo se cambia si otra versión se parece claramente más.
 */
export function pickVariant(cam: ArrayLike<number>, cands: { code: string; sig?: ArrayLike<number> | null }[], prefer?: string): { code: string; score: number } | null {
  const scored = cands.filter(c => c.sig).map(c => ({ code: c.code, score: artSimilarity(cam, c.sig!) })).sort((a, b) => b.score - a.score);
  if (scored.length < 2 || scored[0].score < PICK.min) return null;
  const best = scored[0], pref = scored.find(s => s.code === prefer);
  if (pref && best.score - pref.score < PICK.margin) return pref;
  // versiones con el mismo arte (normal y firmada): empatan, y entre ellas va la más común (código sin letra ni *)
  const ties = scored.filter(s => best.score - s.score < PICK.margin / 2);
  if (ties.length > 1) {
    if (!pref) return null;
    return ties.sort((a, b) => a.code.length - b.code.length || a.code.localeCompare(b.code))[0];
  }
  return best;
}
