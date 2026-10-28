// Motor de sincronización contra un Supabase falso en memoria, con dos "PCs" que comparten la cuenta.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalAdapter, LocalDoc } from '../src/cloud/sync';
import type { Versioned } from '../src/cloud/merge';

// ---- Supabase falso: tablas con clave primaria compuesta y buckets de archivos
const db: Record<string, Map<string, any>> = {};
const files = new Map<string, Blob>();
const PK: Record<string, string[]> = {
  user_settings: ['user_id'], projects: ['user_id', 'project_key'], documents: ['user_id', 'doc_key'], user_assets: ['user_id', 'asset_key'], entitlements: ['user_id'],
};
const table = (t: string) => (db[t] ||= new Map());
const ok = <T>(data: T) => ({ data, error: null });
const fake = {
  from: (t: string) => ({
    select: () => {
      const all = () => [...table(t).values()];
      return { maybeSingle: async () => ok(all()[0] ?? null), then: (res: any, rej: any) => Promise.resolve(ok(all())).then(res, rej) };
    },
    upsert: async (rows: any) => {
      for (const r of [].concat(rows)) table(t).set(PK[t].map(k => (r as any)[k]).join('|'), { ...(table(t).get(PK[t].map(k => (r as any)[k]).join('|')) || {}), ...(r as any) });
      return ok(null);
    },
  }),
  storage: {
    from: (b: string) => ({
      upload: async (p: string, blob: Blob) => { files.set(b + '/' + p, blob); return ok({ path: p }); },
      download: async (p: string) => ok(files.get(b + '/' + p) ?? null),
      remove: async (ps: string[]) => { ps.forEach(p => files.delete(b + '/' + p)); return ok([]); },
    }),
  },
};
vi.mock('../src/cloud/client', () => ({ cloudEnabled: true, supabase: () => fake }));
vi.mock('../src/cloud/auth', () => ({ currentUser: () => ({ id: 'u1' }) }));

// ---- "PC" en memoria que implementa el adaptador local
function device() {
  const s = {
    settings: { data: {} as any, ts: 0 },
    projects: new Map<string, { data: any; ts: number }>(),
    docs: new Map<string, { kind: 'replay' | 'script'; name: string; data: string; ts: number }>(),
    docTombs: new Map<string, number>(),
    assets: new Map<string, { blob: Blob; ts: number }>(),
    assetTombs: new Map<string, number>(),
  };
  const adapter: LocalAdapter = {
    getSettings: () => s.settings,
    applySettings: (data, ts) => { s.settings = { data, ts }; },
    listProjects: () => [...s.projects].map(([key, p]) => ({ key, ...p })),
    putProject: (key, data, ts) => { s.projects.set(key, { data, ts }); },
    listDocs: async () => [
      ...[...s.docs].map(([key, d]) => ({ key, ts: d.ts, kind: d.kind, name: d.name }) as LocalDoc),
      ...[...s.docTombs].filter(([k]) => !s.docs.has(k)).map(([key, ts]) => ({ key, ts, deleted: true, kind: 'script', name: '' }) as LocalDoc),
    ],
    readDoc: async key => s.docs.get(key)?.data ?? null,
    putDoc: async d => { s.docs.set(d.key, { kind: d.kind, name: d.name, data: d.data, ts: d.ts }); s.docTombs.delete(d.key); },
    removeDoc: async (key, ts) => { s.docs.delete(key); s.docTombs.set(key, ts); },
    listAssets: async () => [
      ...[...s.assets].map(([key, a]) => ({ key, ts: a.ts }) as Versioned),
      ...[...s.assetTombs].filter(([k]) => !s.assets.has(k)).map(([key, ts]) => ({ key, ts, deleted: true })),
    ],
    readAsset: async key => s.assets.get(key)?.blob ?? null,
    putAsset: async (key, blob, ts) => { s.assets.set(key, { blob, ts }); s.assetTombs.delete(key); },
    removeAsset: async (key, ts) => { s.assets.delete(key); s.assetTombs.set(key, ts); },
    refresh: () => {},
  };
  return { s, adapter };
}

let sync: typeof import('../src/cloud/sync');
beforeEach(async () => {
  for (const k of Object.keys(db)) delete db[k];
  files.clear();
  vi.resetModules();
  sync = await import('../src/cloud/sync');
});
async function syncAs(d: ReturnType<typeof device>) { sync.configureSync(d.adapter); await sync.syncNow(); expect(sync.syncStatus().state).toBe('idle'); }

describe('sincronización entre dos PCs', () => {
  it('lo que se crea en una PC aparece en la otra (ajustes, clips, guion, replay, imagen)', async () => {
    const A = device(), B = device();
    A.s.settings = { data: { brand: { name: '@MiCanal' } }, ts: 100 };
    A.s.projects.set('rb_proj_x', { data: { marks: { 5: { label: 'Jugadón' } } }, ts: 100 });
    A.s.docs.set('script:Final', { kind: 'script', name: 'Final', data: 'turno j1', ts: 100 });
    A.s.docs.set('rb_proj_replay1', { kind: 'replay', name: 'Replay 1', data: '{"format":"riftatlas-replay"}', ts: 101 });
    A.s.assets.set('card:RAD-164', { blob: new Blob(['img'], { type: 'image/jpeg' }), ts: 100 });
    await syncAs(A);
    await syncAs(B);
    expect(B.s.settings.data.brand.name).toBe('@MiCanal');
    expect(B.s.projects.get('rb_proj_x')?.data.marks[5].label).toBe('Jugadón');
    expect(B.s.docs.get('script:Final')?.data).toBe('turno j1');
    expect(B.s.docs.get('rb_proj_replay1')?.data).toBe('{"format":"riftatlas-replay"}');
    expect(await B.s.assets.get('card:RAD-164')?.blob.text()).toBe('img');
  });

  it('gana el cambio más reciente y los borrados se propagan', async () => {
    const A = device(), B = device();
    A.s.settings = { data: { v: 'viejo' }, ts: 100 };
    A.s.docs.set('script:X', { kind: 'script', name: 'X', data: 'a', ts: 100 });
    A.s.assets.set('snd:battle', { blob: new Blob(['s']), ts: 100 });
    await syncAs(A); await syncAs(B);
    // B cambia los ajustes y borra el guion y el sonido
    B.s.settings = { data: { v: 'nuevo' }, ts: 200 };
    await B.adapter.removeDoc('script:X', 200);
    await B.adapter.removeAsset('snd:battle', 200);
    await syncAs(B); await syncAs(A);
    expect(A.s.settings.data.v).toBe('nuevo');
    expect(A.s.docs.has('script:X')).toBe(false);
    expect(A.s.assets.has('snd:battle')).toBe(false);
    expect([...files.keys()].some(k => k.includes('snd_battle'))).toBe(false);
  });

  it('no baja recientes viejos si la lista local ya está llena', async () => {
    const A = device(), B = device();
    for (let i = 0; i < 10; i++) A.s.docs.set('d' + i, { kind: 'script', name: 'd' + i, data: '', ts: 100 + i });
    await syncAs(A);
    for (let i = 0; i < 8; i++) B.s.docs.set('b' + i, { kind: 'script', name: 'b' + i, data: '', ts: 105 + i });
    await syncAs(B);
    // solo bajan los remotos más nuevos que el reciente más viejo de B (ts 105): d6..d9
    expect([...B.s.docs.keys()].filter(k => k.startsWith('d')).sort()).toEqual(['d6', 'd7', 'd8', 'd9']);
  });
});
