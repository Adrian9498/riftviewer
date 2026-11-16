// Sincronización local-first con Supabase.
// Lo local es la fuente de verdad mientras no hay sesión. Con sesión, cada cambio local agenda
// una sincronización completa (son pocas filas): se compara elemento por elemento y gana el más reciente.
import { currentUser } from './auth';
import { supabase } from './client';
import { planSync, storageName, toIso, toMs, type Versioned } from './merge';

export type DocKind = 'replay' | 'script';
export interface LocalDoc extends Versioned { kind: DocKind; name: string; sub?: string }
export interface DocData { key: string; kind: DocKind; name: string; sub?: string; data: string; ts: number }
export interface LocalProject extends Versioned { data: unknown }
export type Area = 'settings' | 'projects' | 'docs' | 'assets';

/** Cómo leer y escribir los datos locales de la app (lo implementa src/app/cloud-adapter.js). */
export interface LocalAdapter {
  getSettings(): { data: unknown; ts: number };
  applySettings(data: unknown, ts: number): void;
  listProjects(): LocalProject[];
  putProject(key: string, data: unknown, ts: number): void;
  /** recientes, incluidas las lápidas de los borrados */
  listDocs(): Promise<LocalDoc[]>;
  readDoc(key: string): Promise<string | null>;
  putDoc(doc: DocData): Promise<void>;
  removeDoc(key: string, ts: number): Promise<void>;
  /** imágenes y sonidos propios, incluidas las lápidas */
  listAssets(): Promise<Versioned[]>;
  readAsset(key: string): Promise<Blob | null>;
  putAsset(key: string, blob: Blob, ts: number): Promise<void>;
  removeAsset(key: string, ts: number): Promise<void>;
  /** vuelve a pintar lo que cambió al bajar datos de la nube */
  refresh(changed: Set<Area>): void;
}

export type SyncState = 'off' | 'idle' | 'syncing' | 'error';
export interface SyncStatus { state: SyncState; lastSync: number; error?: string }

const MAX_DOCS = 8;   // los recientes que guarda la app
let adapter: LocalAdapter | null = null;
let status: SyncStatus = { state: 'off', lastSync: 0 };
const statusListeners = new Set<(s: SyncStatus) => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false, again = false, applyingRemote = false;

export const syncStatus = (): SyncStatus => status;
export function onSyncStatus(fn: (s: SyncStatus) => void): () => void {
  statusListeners.add(fn); fn(status);
  return () => statusListeners.delete(fn);
}
function setStatus(s: Partial<SyncStatus>) {
  status = { ...status, ...s };
  for (const fn of statusListeners) fn(status);
}

export function configureSync(a: LocalAdapter): void { adapter = a; }
/** true mientras se aplican datos bajados de la nube (para no tomarlos como cambios locales). */
export const isApplyingRemote = (): boolean => applyingRemote;

const SETTINGS_TS = 'rb_settings_ts';
export const settingsTs = (): number => Number(localStorage.getItem(SETTINGS_TS) || 0);

/** Avisa que algo cambió en local; si es un ajuste, guarda la hora del cambio. Agenda la sincronización. */
export function noteLocalChange(area?: Area): void {
  if (applyingRemote) return;
  if (area === 'settings') { try { localStorage.setItem(SETTINGS_TS, String(Date.now())); } catch { /* sin almacenamiento */ } }
  if (!currentUser()) return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), 1500);
}

function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
/** Igual que check, pero exige que haya datos (descargas). */
function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  const d = check(r);
  if (d == null) throw new Error('La nube respondió sin datos');
  return d;
}

/** Sincroniza todo ahora. Si ya hay una sincronización en curso, se repite al terminar. */
export async function syncNow(): Promise<void> {
  const sb = supabase(), user = currentUser();
  if (!sb || !user || !adapter) { setStatus({ state: 'off' }); return; }
  if (running) { again = true; return; }
  running = true; setStatus({ state: 'syncing', error: undefined });
  const a = adapter, uid = user.id, changed = new Set<Area>();
  const apply = async (fn: () => unknown) => { applyingRemote = true; try { await fn(); } finally { applyingRemote = false; } };
  try {
    // ---- ajustes
    const srow = check(await sb.from('user_settings').select('data, updated_at').maybeSingle());
    const ls = a.getSettings(), rts = toMs(srow?.updated_at);
    if (srow && rts > ls.ts) { await apply(() => a.applySettings(srow.data, rts)); changed.add('settings'); }
    else if (ls.ts && (!srow || ls.ts > rts)) check(await sb.from('user_settings').upsert({ user_id: uid, data: ls.data, updated_at: toIso(ls.ts) }));

    // ---- proyectos (clips y notas)
    const prows = check(await sb.from('projects').select('project_key, data, updated_at'));
    const pplan = planSync(a.listProjects(), (prows || []).map(r => ({ key: r.project_key as string, ts: toMs(r.updated_at), data: r.data })));
    if (pplan.push.length) check(await sb.from('projects').upsert(pplan.push.map(p => ({ user_id: uid, project_key: p.key, data: p.data, updated_at: toIso(p.ts) }))));
    if (pplan.pull.length) { await apply(() => pplan.pull.forEach(p => a.putProject(p.key, p.data, p.ts))); changed.add('projects'); }

    // ---- documentos (recientes): guiones en la tabla, replays en Storage
    const drows = check(await sb.from('documents').select('doc_key, kind, name, subtitle, content, storage_path, deleted, updated_at'));
    const remoteDocs = (drows || []).map(r => ({ key: r.doc_key as string, ts: toMs(r.updated_at), deleted: !!r.deleted, row: r }));
    const localDocs = await a.listDocs();
    const dplan = planSync(localDocs, remoteDocs, MAX_DOCS);
    // con la lista local llena, solo bajar lo que sea más nuevo que el reciente más viejo (si no, se recortaría al instante)
    const alive = localDocs.filter(d => !d.deleted), known = new Set(localDocs.map(d => d.key));
    const oldest = alive.length >= MAX_DOCS ? Math.min(...alive.map(d => d.ts)) : 0;
    dplan.pull = dplan.pull.filter(r => known.has(r.key) || r.ts > oldest);
    for (const d of dplan.push) {
      const base = { user_id: uid, doc_key: d.key, kind: d.kind, name: d.name, subtitle: d.sub ?? null, updated_at: toIso(d.ts) };
      if (d.deleted) { check(await sb.from('documents').upsert({ ...base, deleted: true, content: null })); continue; }
      const body = await a.readDoc(d.key); if (body == null) continue;
      if (d.kind === 'script') check(await sb.from('documents').upsert({ ...base, deleted: false, content: body, storage_path: null }));
      else {
        const path = `${uid}/${storageName(d.key)}.json`;
        check(await sb.storage.from('replays').upload(path, new Blob([body], { type: 'application/json' }), { upsert: true, contentType: 'application/json' }));
        check(await sb.from('documents').upsert({ ...base, deleted: false, content: null, storage_path: path }));
      }
    }
    for (const r of dplan.pull) {
      const row = r.row;
      let data: string | null = row.content;
      if (row.kind === 'replay' && row.storage_path) data = await must(await sb.storage.from('replays').download(row.storage_path)).text();
      if (data == null) continue;
      await apply(() => a.putDoc({ key: r.key, kind: row.kind, name: row.name, sub: row.subtitle ?? undefined, data, ts: r.ts }));
      changed.add('docs');
    }
    for (const r of dplan.removeLocal) { await apply(() => a.removeDoc(r.key, r.ts)); changed.add('docs'); }

    // ---- imágenes y sonidos propios
    const arows = check(await sb.from('user_assets').select('asset_key, storage_path, content_type, deleted, updated_at'));
    const remoteAssets = (arows || []).map(r => ({ key: r.asset_key as string, ts: toMs(r.updated_at), deleted: !!r.deleted, row: r }));
    const aplan = planSync(await a.listAssets(), remoteAssets);
    // las repeticiones guardadas en un mazo pesan más: van al bucket de replays (10 MB)
    const bucket = (key: string) => key.startsWith('rep:') ? 'replays' : 'user-assets';
    for (const x of aplan.push) {
      const path = `${uid}/${storageName(x.key)}`;
      if (x.deleted) {
        await sb.storage.from(bucket(x.key)).remove([path]);
        check(await sb.from('user_assets').upsert({ user_id: uid, asset_key: x.key, storage_path: null, deleted: true, updated_at: toIso(x.ts) }));
        continue;
      }
      const blob = await a.readAsset(x.key); if (!blob) continue;
      check(await sb.storage.from(bucket(x.key)).upload(path, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' }));
      check(await sb.from('user_assets').upsert({ user_id: uid, asset_key: x.key, storage_path: path, content_type: blob.type || null, deleted: false, updated_at: toIso(x.ts) }));
    }
    for (const r of aplan.pull) {
      if (!r.row.storage_path) continue;
      const blob = must(await sb.storage.from(bucket(r.key)).download(r.row.storage_path));
      await apply(() => a.putAsset(r.key, blob, r.ts)); changed.add('assets');
    }
    for (const r of aplan.removeLocal) { await apply(() => a.removeAsset(r.key, r.ts)); changed.add('assets'); }

    if (changed.size) await apply(() => a.refresh(changed));
    setStatus({ state: 'idle', lastSync: Date.now() });
  } catch (e) {
    setStatus({ state: 'error', error: e instanceof Error ? e.message : String(e) });
  } finally {
    running = false;
    if (again) { again = false; void syncNow(); }
  }
}
