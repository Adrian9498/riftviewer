// Escáner de cartas con la cámara del dispositivo.
// Lee con OCR (Tesseract.js, en el navegador, sin servidor) el número impreso abajo de la carta ("RAD • 001/167")
// y lo busca en el catálogo. La imagen de la cámara no sale del dispositivo.
import { FINISH_ES, ScanGate, lookalikes, parseCollector, searchPrintings, variantsOf } from '../collection/model';
import { PICK, artSignature, artSimilarity, findByArt, pickVariant, sigFromB64 } from '../collection/artsig';
import { norm } from '../data/text';
import { $, pub } from './base';
import { esc } from './utils';
import { money } from '../cloud/prices';

const READY = 'Pon la carta dentro del marco, con el número de abajo en la franja dorada';
const LOADING = 'Preparando el lector de cartas… (solo la primera vez tarda)';
let S = null;   // estado del escáner abierto

/* ---------- lector (OCR) ----------
   Se carga una sola vez y queda listo entre escaneos (descargar el modelo es lo que más tarda).
   Con varios núcleos se usan dos lectores a la vez, cada uno con un fotograma distinto. */
let POOL = null;
const WORKERS = (navigator.hardwareConcurrency || 2) >= 4 ? 2 : 1;
async function makeWorker(createWorker) {
  const w = await createWorker('eng');
  await w.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/*-•· ', tessedit_pageseg_mode: '6' });
  return w;
}
/** Empieza a cargar el lector en segundo plano (al abrir la colección), para que el escáner arranque al instante. */
export function warmScanner() {
  if (!POOL) POOL = (async () => {
    const { createWorker } = await import('tesseract.js');
    const pool = { workers: [await makeWorker(createWorker)] };
    // el segundo lector se suma cuando esté listo; mientras tanto ya se escanea con el primero
    for (let i = 1; i < WORKERS; i++) makeWorker(createWorker).then(w => pool.workers.push(w)).catch(() => {});
    return pool;
  })();
  POOL.catch(() => { POOL = null; });
  return POOL;
}
/* ---------- huellas del arte ----------
   public/art-sigs.json (se genera con npm run catalogo). Con ellas el escáner compara el arte que ve la cámara:
   elige sola la versión (normal, arte alterno, sobrenumerada…) y corrige el número cuando el OCR confunde cifras. */
let SIGS = null;
function loadSigs() {
  if (!SIGS) SIGS = fetch(pub('art-sigs.json')).then(r => r.ok ? r.json() : null).then(j => {
    const raw = j?.sigs || {}, cache = new Map();
    return { get: code => { if (!raw[code]) return null; if (!cache.has(code)) cache.set(code, sigFromB64(raw[code])); return cache.get(code); }, n: Object.keys(raw).length };
  }).catch(() => null);
  return SIGS;
}
/** Huella del arte de la carta que está en el marco, en el fotograma actual. */
function camSig() {
  const v = $('#csVideo'); if (!v.videoWidth) return null;
  const { gx0, gy0, gw, gh } = guideInVideo(), w = 72, h = Math.round(w * gh / gw);
  if (gw < 40 || !h) return null;
  const c = camSig.c || (camSig.c = document.createElement('canvas'));
  c.width = w; c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(v, gx0, gy0, gw, gh, 0, 0, w, h);
  return artSignature(cx.getImageData(0, 0, w, h).data, w, h);
}
/**
 * Entre la carta leída y las que se le parecen (otras versiones, o el mismo set con una cifra confundida),
 * se queda con la de arte más parecido. Si no hay huellas o el arte no decide, deja la leída.
 */
function byArt(p, hits, sig) {
  const sigs = S.sigs;
  if (!p || !sig || !sigs) return p;
  const { prints, byCode } = S.ctx.cat;
  const cands = [...new Set([...lookalikes(prints, p), ...hits])];
  const r = cands.length > 1 ? pickVariant(sig, cands.map(c => ({ code: c.code, sig: sigs.get(c.code) })), p.code) : null;
  const pick = r ? byCode.get(r.code) || p : p, s = sigs.get(pick.code);
  // si ni la leída ni sus parecidas se parecen a lo que ve la cámara, se busca por arte en todo el set
  if (s && artSimilarity(sig, s) >= PICK.min) return pick;
  const f = findByArt(sig, prints.filter(x => x.set === p.set).map(x => ({ code: x.code, group: x.prefix + x.num, sig: sigs.get(x.code) })));
  return f ? byCode.get(f.code) || pick : pick;
}
/** Libera los lectores (al salir de la colección). */
export function releaseScanner() {
  if (S) return;
  const p = POOL; POOL = null;
  p?.then(pool => pool.workers.forEach(w => w.terminate().catch?.(() => {}))).catch(() => {});
}

/** ctx: { cat:{prints,byCode}, add(code,finish,d), count(code), row(code) } */
export async function openScanner(ctx) {
  if (S) return;
  S = { ctx, open: true, stream: null, pool: null, inflight: 0, timer: 0, fin: 'normal',
    shown: null, alts: [], sess: [], devices: [], dev: -1, torch: false, mode: 0, gate: new ScanGate(), warned: false, seq: 0, done: 0, rr: 0 };
  $('#coscan').hidden = false; document.body.classList.add('scanning');
  $('#csQ').value = ''; $('#csHits').innerHTML = '';
  renderRes(); renderSess();
  // cámara y lector a la vez: ninguno espera al otro
  loadOcr();
  const st = S; loadSigs().then(s => { if (S === st) st.sigs = s; });
  await startCamera();
}
export function closeScanner() {
  if (!S) return;
  S.open = false; clearTimeout(S.timer); stopStream();
  S = null;
  $('#coscan').hidden = true; document.body.classList.remove('scanning');
}

/* ---------- cámara ---------- */
function msg(t, cls = '') { const m = $('#csMsg'); m.textContent = t; m.className = 'csmsg ' + cls; }
function stopStream() { S?.stream?.getTracks().forEach(t => t.stop()); if (S) S.stream = null; const v = $('#csVideo'); if (v) v.srcObject = null; }
async function startCamera(deviceId) {
  stopStream();
  if (!navigator.mediaDevices?.getUserMedia) { msg('Este navegador no deja usar la cámara. Escribe el número de la carta abajo.', 'err'); return; }
  // la mayor resolución posible: el número de la carta es muy chico
  const size = { width: { ideal: 3840 }, height: { ideal: 2160 }, ...NO_EFFECTS };
  try {
    S.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: deviceId ? { deviceId: { exact: deviceId }, ...size } : { facingMode: { ideal: 'environment' }, ...size } });
  } catch (e) {
    msg(e.name === 'NotAllowedError' ? 'No diste permiso para usar la cámara. Actívalo en el candado de la barra de direcciones, o escribe el número abajo.'
      : 'No se encontró una cámara. Puedes escribir el número de la carta abajo.', 'err');
    return;
  }
  if (!S?.open) { S?.stream?.getTracks().forEach(t => t.stop()); return; }
  const v = $('#csVideo'); v.srcObject = S.stream; await v.play().catch(() => {});
  const track = S.stream.getVideoTracks()[0], caps = track.getCapabilities?.() || {};
  await tuneCamera(track, caps);
  S.torch = false; $('#csTorch').hidden = !caps.torch; $('#csTorch').classList.remove('on');
  try { S.devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); } catch (e) { S.devices = []; }
  $('#csFlip').hidden = S.devices.length < 2;
  if (S.dev < 0) S.dev = Math.max(0, S.devices.findIndex(d => d.deviceId === track.getSettings?.().deviceId));
  msg(S.pool ? READY : LOADING);
}
/* ---------- enfoque y efectos de la cámara ----------
   Algunas cámaras (y Windows Studio Effects) siguen caras: encuadran, desenfocan el fondo y enfocan en la persona,
   y la carta queda borrosa. Chrome deja apagar esos efectos y elegir el punto de enfoque cuando la cámara lo permite. */
const NO_EFFECTS = { faceFraming: false, backgroundBlur: false, eyeGazeCorrection: false };
const EFFECT_ES = { faceFraming: 'encuadre de caras', backgroundBlur: 'desenfoque de fondo', eyeGazeCorrection: 'corrección de mirada' };
/** El marco de la pantalla en píxeles del video (el video se muestra recortado para llenar la pantalla: object-fit cover). */
function guideInVideo() {
  const v = $('#csVideo'), vr = v.getBoundingClientRect(), gr = $('#csGuide').getBoundingClientRect();
  const s = Math.max(vr.width / v.videoWidth, vr.height / v.videoHeight), ox = (vr.width - v.videoWidth * s) / 2, oy = (vr.height - v.videoHeight * s) / 2;
  const X = x => (x - vr.left - ox) / s, Y = y => (y - vr.top - oy) / s;
  const gx0 = X(gr.left), gx1 = X(gr.right), gy0 = Y(gr.top), gy1 = Y(gr.bottom);
  return { gx0, gy0, gx1, gy1, gw: gx1 - gx0, gh: gy1 - gy0, X, Y };
}
/** Punto del video, de 0 a 1, donde va el número de la carta. */
function numberPoint() {
  const v = $('#csVideo'); if (!v.videoWidth) return { x: 0.4, y: 0.85 };
  const { gx0, gy0, gw, gh } = guideInVideo(), cl = n => Math.min(1, Math.max(0, n));
  return { x: cl((gx0 + gw * 0.24) / v.videoWidth), y: cl((gy0 + gh * 0.95) / v.videoHeight) };
}
async function setFocus(c) { const t = S?.stream?.getVideoTracks()[0]; if (!t) return false; try { await t.applyConstraints({ advanced: [c] }); return true; } catch (e) { return false; } }
/** Enfoque y exposición en un punto (si la cámara lo permite); por defecto, en el número de la carta. */
async function focusAt(pt = numberPoint(), once = false) {
  if (!S || S.manual) return;
  const caps = S.caps || {}, c = {};
  if (S.poi) c.pointsOfInterest = [pt];
  if (once && caps.focusMode?.includes('single-shot')) c.focusMode = 'single-shot';
  else if (caps.focusMode?.includes('continuous')) c.focusMode = 'continuous';
  if (Object.keys(c).length) await setFocus(c);
  if (once && c.focusMode === 'single-shot') setTimeout(() => focusAt(), 1500);   // después vuelve al enfoque continuo en el número
}
async function tuneCamera(track, caps) {
  S.caps = caps; S.manual = false;
  S.poi = !!navigator.mediaDevices.getSupportedConstraints?.().pointsOfInterest;
  // apagar los efectos que la cámara permita apagar
  const off = Object.keys(NO_EFFECTS).filter(k => Array.isArray(caps[k]) && caps[k].includes(false));
  if (off.length) await setFocus(Object.fromEntries(off.map(k => [k, false])));
  const still = Object.keys(NO_EFFECTS).filter(k => track.getSettings?.()[k] === true);
  S.effects = still.length ? `Tu cámara tiene activado: ${still.map(k => EFFECT_ES[k]).join(', ')}. Desactívalo en la configuración de cámara del sistema.`
    : off.length ? `Se apagó: ${off.map(k => EFFECT_ES[k]).join(', ')}.` : '';
  await focusAt();
  // enfoque manual, si la cámara lo permite
  const fd = caps.focusDistance, man = !!fd && caps.focusMode?.includes('manual');
  $('#csFocusW').hidden = !man;
  if (man) { const r = $('#csFocus'); r.min = fd.min; r.max = fd.max; r.step = fd.step || (fd.max - fd.min) / 100; r.value = track.getSettings?.().focusDistance ?? fd.min; }
  $('#csFocusAuto').classList.add('on');
  $('#csCam').textContent = S.effects;
}
async function toggleTorch() {
  const track = S?.stream?.getVideoTracks()[0]; if (!track) return;
  S.torch = !S.torch;
  try { await track.applyConstraints({ advanced: [{ torch: S.torch }] }); $('#csTorch').classList.toggle('on', S.torch); } catch (e) { S.torch = false; }
}
function flipCamera() {
  if (!S || S.devices.length < 2) return;
  S.dev = (S.dev + 1) % S.devices.length;
  startCamera(S.devices[S.dev].deviceId);
}

/* ---------- lectura ---------- */
async function loadOcr() {
  try {
    const pool = await warmScanner();
    if (!S?.open) return;
    S.pool = pool;
    if (S.stream) msg(READY);
    loop();
  } catch (e) {
    if (S?.open) msg('No se pudo cargar el lector (' + e.message + '). Puedes escribir el número abajo.', 'err');
  }
}
/** Cada lector libre recibe el fotograma más reciente, sin pausas entre lecturas. */
function loop() {
  if (!S?.open) return;
  if (S.stream && !document.hidden) while (S.inflight < S.pool.workers.length) { if (!scanOnce(S.pool.workers[S.rr++ % S.pool.workers.length])) break; }
  // se insiste en enfocar el número: hay cámaras que vuelven solas a buscar caras
  if (!S.manual && Date.now() - (S.focusT || 0) > 4000) { S.focusT = Date.now(); focusAt(); }
  S.timer = setTimeout(loop, 40);
}
/** Recorta la franja de abajo del marco (donde va el número), la agranda lo justo y la pasa a blanco y negro. */
function grab() {
  const v = $('#csVideo');
  if (!v.videoWidth) return null;
  const { gx0, gy0, gw, gh, gy1 } = guideInVideo();
  // con poca resolución el número no se puede leer (hacen falta ~500 px de alto de carta en el video)
  if (!S.warned && gh < 480) { S.warned = true; msg('Tu cámara da poca resolución para leer el número. Usa buena luz o la cámara del teléfono.', 'err'); }
  // el número va en el borde negro de abajo a la izquierda ("UNL • 123/219"), en letras blancas de ~2% del alto de la carta.
  // Se van turnando: recorte justo en gris, recorte amplio en gris (por si la carta no quedó exacta) y recorte justo en blanco y negro.
  // El gris lee mejor con poca resolución; el blanco y negro, con buena luz.
  // Recorte angosto: el número nunca pasa del 30% del ancho, y así no entra la ilustración (que confunde al filtro).
  // Modos: 0 y 1 con filtro adaptativo (busca texto más claro que lo que lo rodea: lee el número blanco sobre el borde
  // negro y sobre ilustraciones claras, en artes alternos, sobrenumeradas y SP), a dos tamaños; 2 en gris, de respaldo.
  const mode = S.mode = (S.mode + 1) % 3;
  const [fx, fy, fw, tgt] = mode === 1 ? [0, 0.935, 0.32, 160] : mode === 2 ? [-0.01, 0.9, 0.36, 150] : [0, 0.935, 0.32, 110];
  const x0 = Math.max(0, gx0 + gw * fx), y0 = Math.max(0, gy0 + gh * fy);
  const x1 = Math.min(v.videoWidth, gx0 + gw * (fx + fw)), y1 = Math.min(v.videoHeight, gy1 + gh * 0.02);
  const sw = x1 - x0, sh = y1 - y0;
  if (sw < 20 || sh < 6) return null;
  // se agranda para que el número quede a ~35 px de alto, lo que mejor lee el OCR
  const k = Math.min(5, tgt / sh), c = document.createElement('canvas');
  c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(v, x0, y0, sw, sh, 0, 0, c.width, c.height);
  if (mode === 2) prep(cx, c.width, c.height, false); else adaptive(cx, c.width, c.height);
  return c;
}
/**
 * Umbral adaptativo: un píxel es letra si es bastante más claro que el promedio de su zona (ventana de ~15% del alto).
 * El número de las cartas va en blanco, y así se separa tanto del borde negro como de una ilustración clara.
 * Probado con cartas base, arte alterno, sobrenumeradas, firmadas y SP desde ~480 px de alto de carta.
 */
function adaptive(cx, w, h) {
  const im = cx.getImageData(0, 0, w, h), d = im.data, n = w * h, g = new Float32Array(n), W = w + 1;
  for (let i = 0, j = 0; j < n; i += 4, j++) g[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
  const I = new Float64Array(W * (h + 1));   // imagen integral: promedio de cualquier ventana en tiempo constante
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += g[y * w + x]; I[(y + 1) * W + x + 1] = I[y * W + x + 1] + row; } }
  const r = Math.max(8, Math.round(h * 0.15)), C = 25;
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const m = (I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0]) / ((x1 - x0) * (y1 - y0));
      const k = (y * w + x) * 4; d[k] = d[k + 1] = d[k + 2] = g[y * w + x] > m + C ? 0 : 255;
    }
  }
  cx.putImageData(im, 0, 0);
}
function prep(cx, w, h, binary) {
  const im = cx.getImageData(0, 0, w, h), d = im.data, n = w * h, g = new Uint8Array(n), hist = new Array(256).fill(0);
  for (let i = 0, j = 0; j < n; i += 4, j++) { const y = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; g[j] = y; hist[y]++; }
  // umbral de Otsu
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, best = 0, th = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue; const wF = n - wB; if (!wF) break;
    sB += i * hist[i]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2;
    if (v > best) { best = v; th = i; }
  }
  let dark = 0; for (let j = 0; j < n; j++) if (g[j] <= th) dark++;
  const inv = dark > n / 2;   // fondo oscuro con letras claras: se invierte para que queden letras negras sobre blanco
  for (let i = 0, j = 0; j < n; i += 4, j++) {
    const val = binary ? ((g[j] > th) !== inv ? 255 : 0) : (inv ? 255 - g[j] : g[j]);
    d[i] = d[i + 1] = d[i + 2] = val;
  }
  cx.putImageData(im, 0, 0);
}
/** Lanza la lectura de un fotograma; devuelve false si todavía no hay imagen. */
function scanOnce(worker) {
  const c = grab(); if (!c) return false;
  const st = S, seq = ++st.seq, sig = st.sigs ? camSig() : null;   // el arte del mismo fotograma que se lee
  st.inflight++;
  worker.recognize(c, {}, { text: true, blocks: false, hocr: false, tsv: false })
    .then(r => { st.inflight--; if (S === st && st.open && seq > st.done) { st.done = seq; read((r.data.text || '').replace(/\s+/g, ' ').trim(), sig); } })
    .catch(() => { st.inflight--; });
  return true;
}
function read(text, sig) {
  const heard = $('#csHeard'); if (heard) heard.textContent = text ? 'Leí: ' + text.slice(0, 60) : '';
  const { hits, sure } = parseCollector(text, S.ctx.cat.prints), ocr = hits[0];
  // el arte corrige antes de votar: así la lectura equivocada y la corregida cuentan como la misma carta
  const top = byArt(ocr, hits, sig), fixed = top !== ocr;
  // la regla de cuándo aceptar (y no sumar dos veces la misma carta) está en ScanGate
  const code = S.gate.feed(top?.code || null, sure && !fixed, Date.now(), $('#csAuto').checked);
  if (code) { S.byArt = fixed ? ocr.code : null; found(top, hits); }
}

/* ---------- resultado ---------- */
const finFor = p => p.finishes.includes(S.fin) ? S.fin : p.finishes[0];
function found(p, hits = []) {
  S.shown = p;
  S.alts = [...new Set([...variantsOf(S.ctx.cat.prints, p), ...hits])];
  navigator.vibrate?.(30);
  const g = $('#csGuide'); g.classList.remove('hit'); void g.offsetWidth; g.classList.add('hit');
  if ($('#csAuto').checked) add(p, finFor(p));
  else { msg(`Encontré ${p.name}${S.byArt ? ` (por el arte; leí ${S.byArt})` : ''}. Toca "+1" para sumarla.`, 'ok'); renderRes(); }
}
function add(p, f) {
  S.ctx.add(p.code, f, 1);
  S.sess.push({ code: p.code, f });
  msg(`+1 ${p.name}${f === 'normal' ? '' : ' (' + (FINISH_ES[f] || f) + ')'}${S.byArt ? ` · por el arte (leí ${S.byArt})` : ''}. Siguiente carta.`, 'ok');
  S.byArt = null;
  renderRes(); renderSess();
}
function renderRes() {
  const p = S?.shown;
  if (!p) { $('#csRes').innerHTML = '<div class="cshint">Apunta al número de la carta (abajo). Con buena luz y sin reflejos lee más rápido.<span id="csHeard"></span></div>'; return; }
  const row = S.ctx.row(p.code), have = Object.entries(row).map(([f, n]) => `${n} ${(FINISH_ES[f] || f).toLowerCase()}`).join(', ');
  $('#csRes').innerHTML = `<div class="csc"><img src="${esc(p.img)}" alt="">
    <div class="csi"><b>${esc(p.name)}</b><small>${p.code} · ${p.rarity}${p.variant !== 'Normal' ? ' · ' + p.variant : ''}</small>
      <span class="cshave">${have ? 'Tienes: ' + have : 'Todavía no la tienes'}${S.ctx.price?.(p.code, finFor(p)) != null ? ` · <b>${money(S.ctx.price(p.code, finFor(p)))}</b>` : ''}</span>
      <div class="csbtns">${p.finishes.map(f => `<button class="btn${f === finFor(p) ? ' primary' : ''}" data-csadd="${f}">+1 ${FINISH_ES[f] || f}</button>`).join('')}</div>
      ${S.alts.length > 1 ? `<div class="csalts"><small>¿Es otra versión?</small>${S.alts.map(a => `<button class="chip${a.code === p.code ? ' on' : ''}" data-csalt="${a.code}">${a.code} · ${a.variant}</button>`).join('')}</div>` : ''}
    </div></div><span id="csHeard"></span>`;
}
function renderSess() {
  const n = S?.sess.length || 0;
  $('#csSess').innerHTML = n ? `${n} carta${n === 1 ? '' : 's'} en esta sesión <button class="btn mini" data-csundo>Deshacer la última</button>` : '';
}
function undo() {
  const last = S.sess.pop(); if (!last) return;
  S.ctx.add(last.code, last.f, -1);
  msg('Se quitó la última carta.'); renderRes(); renderSess();
}

export function init() {
  $('#csClose').onclick = closeScanner;
  $('#csTorch').onclick = toggleTorch;
  $('#csFlip').onclick = flipCamera;
  $('#csFin').onclick = e => {
    const b = e.target.closest('[data-fin]'); if (!b || !S) return;
    S.fin = b.dataset.fin; $('#csFin').querySelectorAll('[data-fin]').forEach(x => x.classList.toggle('on', x === b)); renderRes();
  };
  $('#coscan').addEventListener('click', e => {
    if (!S) return;
    const a = e.target.closest('[data-csadd]'); if (a && S.shown) { add(S.shown, a.dataset.csadd); return; }
    const alt = e.target.closest('[data-csalt]');
    if (alt) { const p = S.ctx.cat.byCode.get(alt.dataset.csalt); if (p) { S.shown = p; if (!S.alts.includes(p)) S.alts = variantsOf(S.ctx.cat.prints, p); renderRes(); } return; }
    if (e.target.closest('[data-csundo]')) undo();
  });
  $('#csQ').oninput = e => {
    if (!S) return;
    const hits = searchPrintings(e.target.value, S.ctx.cat.prints, norm, 8);
    $('#csHits').innerHTML = hits.map(p => `<button class="chip" data-cspick="${p.code}">${esc(p.name)} <small>${p.code}</small></button>`).join('');
  };
  $('#csHits').onclick = e => {
    const b = e.target.closest('[data-cspick]'); if (!b || !S) return;
    const p = S.ctx.cat.byCode.get(b.dataset.cspick); if (!p) return;
    S.shown = p; S.alts = variantsOf(S.ctx.cat.prints, p); S.gate.pick(p.code, Date.now());
    $('#csQ').value = ''; $('#csHits').innerHTML = ''; renderRes(); msg(`Elegiste ${p.name}. Toca "+1" para sumarla.`, 'ok');
  };
  // enfoque: tocar la imagen enfoca ahí; la barra lo mueve a mano; "Auto" vuelve a enfocar solo en el número
  $('#csVideo').addEventListener('click', e => {
    const v = $('#csVideo'); if (!S || !v.videoWidth) return;
    const { X, Y } = guideInVideo();
    S.manual = false; S.focusT = Date.now() + 2000; $('#csFocusAuto').classList.add('on');
    focusAt({ x: Math.min(1, Math.max(0, X(e.clientX) / v.videoWidth)), y: Math.min(1, Math.max(0, Y(e.clientY) / v.videoHeight)) }, true);
  });
  $('#csFocus').oninput = e => { if (!S) return; S.manual = true; $('#csFocusAuto').classList.remove('on'); setFocus({ focusMode: 'manual', focusDistance: +e.target.value }); };
  $('#csFocusAuto').onclick = () => { if (!S) return; S.manual = false; $('#csFocusAuto').classList.add('on'); focusAt(); };
  addEventListener('keydown', e => { if (e.key === 'Escape' && S) closeScanner(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S?.torch) toggleTorch(); });
}
