// Beta cerrada: ¿la app pide invitación, y la sesión actual la tiene?
// El interruptor y la lista de invitados viven en Supabase (migración 20261116120000_beta_cerrada.sql).
import { supabase } from './client';

export interface BetaState { cerrada: boolean; acceso: boolean }
const CACHE = 'rb_beta';

/** Pregunta a Supabase. null si no hay nube o no se pudo saber (sin conexión, o falta la migración). */
export async function fetchBeta(): Promise<BetaState | null> {
  const db = supabase(); if (!db) return null;
  try {
    const { data, error } = await db.rpc('beta_estado');
    if (error || !data) return null;
    const st = { cerrada: !!(data as BetaState).cerrada, acceso: !!(data as BetaState).acceso };
    try { localStorage.setItem(CACHE, JSON.stringify(st)); } catch { /* solo en memoria */ }
    return st;
  } catch { return null; }
}
/** Lo último que se supo (para no mostrar la pantalla de acceso un instante al abrir). */
export function cachedBeta(): BetaState | null {
  try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); return c && typeof c.cerrada === 'boolean' ? c : null; } catch { return null; }
}
/** ¿Se puede usar la app? Sin saber nada (sin nube, o Supabase sin la migración) la app queda abierta. */
export const canUse = (st: BetaState | null) => !st || !st.cerrada || st.acceso;

/**
 * Al volver de Google/Discord con un correo sin invitación, Supabase regresa con un error en la dirección
 * ("Database error saving new user", porque el candado rechazó el registro). true si es ese caso.
 */
export function deniedByBeta(href: string): boolean {
  const q = decodeURIComponent(href.replace(/\+/g, ' ')).toLowerCase();
  return /error_description=[^&#]*(database error saving new user|beta cerrada)/.test(q);
}
