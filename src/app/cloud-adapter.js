// Puente entre los datos locales de la app (localStorage + IndexedDB) y la sincronización con la nube.
import { noteLocalChange, settingsTs } from '../cloud/sync';
import { $ } from './base';
import { BR, BRIMG, applyBrand } from './brand';
import { CUSTOM, IDB } from './cards';
import { PROJKEY, loadProj, renderClips } from './clips';
import { renderNotes } from './notes';
import { buildFrameList } from './replay';
import { renderRecents, setFmt, setSkin } from './shell';
import { SFX, SND, saveSnd } from './sounds';
import { app } from './state';
import { rerender } from './utils';

const MAX_DOCS = 8;
const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (e) { return d; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin espacio */ } };

/* ---- lápidas y fechas de cambio (para saber qué es más nuevo y propagar borrados) ---- */
const DOC_TOMBS = 'rb_doc_tombs';      // { docKey: ts }
const ASSET_META = 'rb_asset_meta';    // { assetKey: { ts, deleted? } }

/** Llamar al guardar o borrar una imagen/sonido propio (claves 'card:…', 'brand:…', 'snd:…'). */
export function touchAsset(key, deleted = false) {
  const meta = readJSON(ASSET_META, {}); meta[key] = deleted ? { ts: Date.now(), deleted: true } : { ts: Date.now() };
  writeJSON(ASSET_META, meta); noteLocalChange('assets');
}
/** Llamar al quitar un documento de recientes a propósito (no al recortar la lista). */
export function tombDoc(key) {
  const t = readJSON(DOC_TOMBS, {}); t[key] = Date.now(); writeJSON(DOC_TOMBS, t); noteLocalChange('docs');
}

const blobToDataURL = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });

export const localAdapter = {
  getSettings() {
    return {
      ts: settingsTs(),
      data: { brand: { ...BR }, sounds: { ...SND }, view: { layout: localStorage.getItem('rb_lay2'), camera: localStorage.getItem('rb_cam'), fmt: localStorage.getItem('rb_fmt'), skin: localStorage.getItem('rb_skin') } },
    };
  },
  applySettings(data, ts) {
    if (data?.brand) { Object.assign(BR, data.brand); applyBrand(); }
    if (data?.sounds) { Object.assign(SND, data.sounds, { ev: { ...SND.ev, ...data.sounds.ev } }); saveSnd(); }
    const v = data?.view || {};
    if (v.layout) { localStorage.setItem('rb_lay2', v.layout); $('#rlay').value = v.layout; }
    if (v.camera) { localStorage.setItem('rb_cam', v.camera); $('#rcamsel').value = v.camera; }
    if (v.fmt && v.fmt !== $('#stage').className) setFmt(v.fmt);
    if (v.skin && v.skin !== $('#stage').dataset.skin) setSkin(v.skin);
    localStorage.setItem('rb_settings_ts', String(ts));
  },

  listProjects() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); if (!k || !k.startsWith('rb_proj_')) continue;
      const data = readJSON(k, null); if (data) out.push({ key: k, ts: data.ts || 0, data });
    }
    return out;
  },
  putProject(key, data, ts) { writeJSON(key, { ...data, ts }); },

  async listDocs() {
    const items = (await IDB.entries()).filter(([k]) => k.startsWith('recent:')).map(([, v]) => ({ key: v.id, ts: v.ts || 0, kind: v.kind, name: v.name, sub: v.sub }));
    const tombs = readJSON(DOC_TOMBS, {});
    for (const [key, ts] of Object.entries(tombs)) {
      const live = items.find(d => d.key === key);
      if (!live) items.push({ key, ts, deleted: true, kind: 'script', name: '' });
      else if (ts > live.ts) Object.assign(live, { ts, deleted: true });
    }
    return items;
  },
  async readDoc(key) { return (await IDB.get('recent:' + key))?.data ?? null; },
  async putDoc(d) {
    await IDB.set('recent:' + d.key, { id: d.key, kind: d.kind, name: d.name, sub: d.sub, data: d.data, ts: d.ts });
    const t = readJSON(DOC_TOMBS, {}); if (d.key in t) { delete t[d.key]; writeJSON(DOC_TOMBS, t); }
    // misma regla que la app: solo los 8 más recientes
    const old = (await IDB.entries()).filter(([k]) => k.startsWith('recent:')).sort((a, b) => b[1].ts - a[1].ts).slice(MAX_DOCS);
    for (const [k] of old) await IDB.del(k);
  },
  async removeDoc(key, ts) {
    await IDB.del('recent:' + key).catch(() => {});
    const t = readJSON(DOC_TOMBS, {}); t[key] = ts; writeJSON(DOC_TOMBS, t);
  },

  async listAssets() {
    const meta = readJSON(ASSET_META, {});
    const keys = (await IDB.entries()).map(([k]) => k).filter(k => /^(card|brand|snd):/.test(k));
    const out = keys.map(k => ({ key: k, ts: meta[k]?.deleted ? 0 : (meta[k]?.ts || 0) }));
    for (const [k, m] of Object.entries(meta)) if (m.deleted && !keys.includes(k)) out.push({ key: k, ts: m.ts, deleted: true });
    return out;
  },
  async readAsset(key) {
    const v = await IDB.get(key);
    if (!v) return null;
    if (v instanceof Blob) return v;
    if (typeof v === 'string' && v.startsWith('data:')) return await (await fetch(v)).blob();
    return null;
  },
  async putAsset(key, blob, ts) {
    if (key.startsWith('snd:')) {
      const k = key.slice(4); await IDB.set(key, blob); SFX.blobs[k] = blob; if (SFX.ctx) await SFX.decode(k);
    } else {
      const url = await blobToDataURL(blob); await IDB.set(key, url);
      if (key.startsWith('card:')) CUSTOM.set(key, url); else BRIMG[key.slice(6)] = url;
    }
    const meta = readJSON(ASSET_META, {}); meta[key] = { ts }; writeJSON(ASSET_META, meta);
  },
  async removeAsset(key, ts) {
    await IDB.del(key).catch(() => {});
    if (key.startsWith('snd:')) { delete SFX.blobs[key.slice(4)]; delete SFX.bufs[key.slice(4)]; }
    else if (key.startsWith('card:')) CUSTOM.delete(key); else BRIMG[key.slice(6)] = null;
    const meta = readJSON(ASSET_META, {}); meta[key] = { ts, deleted: true }; writeJSON(ASSET_META, meta);
  },

  refresh(changed) {
    if (changed.has('projects') && PROJKEY) { loadProj(PROJKEY); if (app.R) buildFrameList(); renderClips(); renderNotes(); }
    if (changed.has('docs') && $('#home').classList.contains('show')) renderRecents();
    if (changed.has('settings') || changed.has('assets')) { applyBrand(); rerender(); }
  },
};
