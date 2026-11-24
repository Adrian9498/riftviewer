// Interruptores de la app que viven en Supabase (tabla beta_config):
// - cerrada: la app pide invitación (beta cerrada) y la sesión actual la tiene o no (acceso).
// - cupo / lugares: beta abierta con un límite de cuentas (hace falta cuenta; se registran hasta llenar los lugares).
// - patreon: Full Access se obtiene con Patreon. Apagado, todos tienen todo y no se muestra nada de Patreon.
// Migraciones 20261116120000_beta_cerrada.sql, 20261116130000_interruptor_patreon.sql y 20261124120000_beta_abierta_cupo.sql.
import { supabase } from './client';

export interface BetaState { cerrada: boolean; acceso: boolean; patreon: boolean; cupo: number | null; lugares: number | null }
const num = (x: unknown) => typeof x === 'number' && isFinite(x) ? x : null;
const CACHE = 'rb_beta';
const listeners = new Set<(st: BetaState | null) => void>();

/** Avisa cada vez que se sabe un estado nuevo. */
export function onBeta(fn: (st: BetaState | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Pregunta a Supabase. null si no hay nube o no se pudo saber (sin conexión, o falta la migración). */
export async function fetchBeta(): Promise<BetaState | null> {
  const db = supabase(); if (!db) return null;
  try {
    const { data, error } = await db.rpc('beta_estado');
    if (error || !data) return null;
    const d = data as Partial<BetaState>;
    const st = { cerrada: !!d.cerrada, acceso: !!d.acceso, patreon: !!d.patreon, cupo: num(d.cupo), lugares: num(d.lugares) };
    try { localStorage.setItem(CACHE, JSON.stringify(st)); } catch { /* solo en memoria */ }
    for (const fn of listeners) fn(st);
    return st;
  } catch { return null; }
}
/** Lo último que se supo (para no mostrar la pantalla de acceso un instante al abrir). */
export function cachedBeta(): BetaState | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || 'null');
    return c && typeof c.cerrada === 'boolean' ? { cerrada: c.cerrada, acceso: !!c.acceso, patreon: !!c.patreon, cupo: num(c.cupo), lugares: num(c.lugares) } : null;
  } catch { return null; }
}
/** ¿Se puede usar la app? Sin saber nada (sin nube, o Supabase sin la migración) la app queda abierta. */
export const canUse = (st: BetaState | null) => !st || st.acceso || (!st.cerrada && st.cupo == null);
/** ¿La beta está abierta con cupo? (hace falta cuenta, cualquiera se registra mientras haya lugares) */
export const withCupo = (st: BetaState | null) => !!st && !st.cerrada && st.cupo != null;
/** ¿Está encendido Patreon? Mientras no se sepa, apagado: todo desbloqueado. */
export const patreonOn = (): boolean => !!cachedBeta()?.patreon;

/**
 * Al volver de Google/Discord con un correo sin invitación, Supabase regresa con un error en la dirección
 * ("Database error saving new user", porque el candado rechazó el registro). true si es ese caso.
 */
export function deniedByBeta(href: string): boolean {
  const q = decodeURIComponent(href.replace(/\+/g, ' ')).toLowerCase();
  return /error_description=[^&#]*(database error saving new user|beta cerrada|cupo lleno)/.test(q);
}
