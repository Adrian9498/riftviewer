// Cliente de Supabase. Si no hay URL/clave configuradas (.env.local), la app funciona solo en local.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const cloudEnabled = !!(url && anonKey);

let client: SupabaseClient | null = null;

/** El cliente de Supabase, o null si la nube no está configurada. */
export function supabase(): SupabaseClient | null {
  if (!cloudEnabled) return null;
  if (!client) client = createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}
