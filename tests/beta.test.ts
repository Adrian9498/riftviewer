// @vitest-environment jsdom
// Beta cerrada: la pantalla de acceso de la app, con un Supabase de mentira.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { canUse, deniedByBeta } from '../src/cloud/beta';

// ---------- Supabase de mentira: estado de la beta y sesión que cambiamos en cada prueba ----------
const fake = vi.hoisted(() => {
  const st = { beta: { cerrada: true, acceso: false } as { cerrada: boolean; acceso: boolean } | null, session: null as unknown, authCb: null as null | ((ev: string, s: unknown) => void) };
  // cualquier consulta encadenada (from().select().order()…) responde vacío
  const chain = (): unknown => new Proxy(function () {}, {
    get: (_t, k) => k === 'then' ? (res: (v: unknown) => void) => res({ data: null, error: null }) : chain(),
    apply: () => chain(),
  });
  const client = {
    rpc: async (name: string) => name === 'beta_estado' ? (st.beta ? { data: st.beta, error: null } : { data: null, error: { message: 'no existe' } }) : { data: null, error: null },
    from: () => chain(),
    functions: { invoke: async () => ({ data: null, error: null }) },
    auth: {
      onAuthStateChange: (cb: (ev: string, s: unknown) => void) => { st.authCb = cb; return { data: { subscription: { unsubscribe() {} } } }; },
      getSession: async () => ({ data: { session: st.session } }),
      signOut: async () => { st.session = null; st.authCb?.('SIGNED_OUT', null); return { error: null }; },
    },
  };
  return { st, client };
});
vi.mock('../src/cloud/client', () => ({ cloudEnabled: true, supabase: () => fake.client }));
vi.mock('tesseract.js', () => ({ createWorker: async () => { throw new Error('sin OCR'); } }));

const html = readFileSync(resolve(process.cwd(), 'app/index.html'), 'utf8');
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const settle = () => new Promise(r => setTimeout(r, 20));
const signIn = async (email: string) => {
  fake.st.session = { user: { id: 'u-' + email, email, user_metadata: {} } };
  fake.st.authCb?.('SIGNED_IN', fake.st.session);
  await settle();
};

beforeAll(async () => {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  (Element.prototype as any).animate = () => ({ finished: Promise.resolve(), cancel() {} });
  (Element.prototype as any).scrollIntoView = () => {};
  (globalThis as any).CSS = { escape: (s: string) => s };
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => null })));
  await import('../src/main');
  await settle();
});

describe('beta cerrada', () => {
  it('sin sesión: la app queda tapada y pide entrar con la invitación', () => {
    expect($('#gate').hidden).toBe(false);
    expect($('#gate').textContent).toContain('beta cerrada');
    expect($('#gate [data-g="login"]')).not.toBeNull();
    expect($('#gate [data-g="signup"]')).not.toBeNull();
  });

  it('con una cuenta sin invitación: lo dice y deja cerrar sesión', async () => {
    fake.st.beta = { cerrada: true, acceso: false };
    await signIn('nadie@correo.com');
    expect($('#gate').hidden).toBe(false);
    expect($('#gate').textContent).toContain('no tiene invitación');
    expect($('#gate [data-g="out"]')).not.toBeNull();
  });

  it('con una cuenta invitada: entra a la app', async () => {
    fake.st.beta = { cerrada: true, acceso: true };
    await signIn('invitado@correo.com');
    expect($('#gate').hidden).toBe(true);
    expect(document.body.classList.contains('gated')).toBe(false);
  });

  it('al cerrar sesión se vuelve a tapar; y con la beta abierta no aparece', async () => {
    fake.st.beta = { cerrada: true, acceso: false };
    ($('#gate') as HTMLElement).hidden = true;
    await fake.client.auth.signOut();
    await settle();
    expect($('#gate').hidden).toBe(false);
    fake.st.beta = { cerrada: false, acceso: true };
    fake.st.authCb?.('SIGNED_IN', null);
    await settle();
    expect($('#gate').hidden).toBe(true);
  });
});

describe('reglas de acceso', () => {
  it('sin saber el estado (sin nube o sin la migración) la app queda abierta', () => {
    expect(canUse(null)).toBe(true);
    expect(canUse({ cerrada: false, acceso: false })).toBe(true);
    expect(canUse({ cerrada: true, acceso: true })).toBe(true);
    expect(canUse({ cerrada: true, acceso: false })).toBe(false);
  });
  it('reconoce el regreso de Google/Discord rechazado por el candado', () => {
    expect(deniedByBeta('https://riftviewer.com/app/#error=server_error&error_code=unexpected_failure&error_description=Database+error+saving+new+user')).toBe(true);
    expect(deniedByBeta('https://riftviewer.com/app/?error=server_error&error_description=Database%20error%20saving%20new%20user')).toBe(true);
    expect(deniedByBeta('https://riftviewer.com/app/#/mazos')).toBe(false);
  });
});
