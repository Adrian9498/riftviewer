// Sesión del usuario: email + contraseña, Google y Discord.
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase } from './client';

export type OAuthProvider = 'google' | 'discord';
type Listener = (user: User | null, event: AuthChangeEvent | 'INITIAL') => void;

let current: User | null = null;
const listeners = new Set<Listener>();

export const currentUser = (): User | null => current;

/** Avisa cada vez que cambia la sesión (y una vez al suscribirse, con el estado actual). */
export function onUserChange(fn: Listener): () => void {
  listeners.add(fn);
  fn(current, 'INITIAL');
  return () => listeners.delete(fn);
}

/** Empieza a escuchar la sesión. Recupera la sesión guardada y procesa el regreso de Google/Discord. */
export async function initAuth(): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  sb.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
    current = session?.user ?? null;
    for (const fn of listeners) fn(current, event);
  });
  const { data } = await sb.auth.getSession();
  current = data.session?.user ?? null;
  for (const fn of listeners) fn(current, 'INITIAL');
}

const need = () => {
  const sb = supabase();
  if (!sb) throw new Error('La nube no está configurada');
  return sb;
};
// adonde vuelve el usuario después de confirmar su correo o entrar con Google/Discord
const returnUrl = () => location.origin + location.pathname;

const traducir = (msg: string): string => {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de entrar (revisa tu bandeja de entrada).';
  if (m.includes('already registered')) return 'Ya existe una cuenta con ese correo.';
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('rate limit')) return 'Demasiados intentos. Espera un momento y vuelve a intentar.';
  return msg;
};
async function run<R extends { data: unknown; error: { message: string } | null }>(p: Promise<R>): Promise<R['data']> {
  const { data, error } = await p;
  if (error) throw new Error(traducir(error.message));
  return data;
}

export const signIn = (email: string, password: string) => run(need().auth.signInWithPassword({ email, password }));

/** Crea la cuenta. Devuelve true si hay que confirmar el correo antes de entrar. */
export async function signUp(email: string, password: string): Promise<boolean> {
  const data = await run(need().auth.signUp({ email, password, options: { emailRedirectTo: returnUrl() } }));
  return !data.session;
}

let providersCache: Promise<Record<OAuthProvider, boolean>> | null = null;
/** Qué proveedores (Google, Discord) están activados en el proyecto de Supabase. */
export function enabledProviders(): Promise<Record<OAuthProvider, boolean>> {
  const none = { google: false, discord: false };
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined, key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return Promise.resolve(none);
  return (providersCache ||= fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
    .then(r => (r.ok ? r.json() : null))
    .then(s => ({ google: !!s?.external?.google, discord: !!s?.external?.discord }))
    .catch(() => { providersCache = null; return none; }));
}

export const signInWith = (provider: OAuthProvider) =>
  run(need().auth.signInWithOAuth({ provider, options: { redirectTo: returnUrl() } }));

export const sendPasswordReset = (email: string) =>
  run(need().auth.resetPasswordForEmail(email, { redirectTo: returnUrl() }));

export const setNewPassword = (password: string) => run(need().auth.updateUser({ password }));

export async function signOut(): Promise<void> {
  await need().auth.signOut();
}

/** Nombre para mostrar: el del perfil de Google/Discord o la parte del correo antes de la @. */
export function displayName(u: User | null): string {
  if (!u) return '';
  const m = u.user_metadata || {};
  return m.full_name || m.name || m.user_name || (u.email || '').split('@')[0];
}
