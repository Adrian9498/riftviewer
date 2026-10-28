// Vincular la cuenta de Patreon (las Edge Functions hacen el trabajo con las claves secretas).
import { currentUser } from './auth';
import { supabase } from './client';

export interface PatreonLink { patron_status: string | null; tier_ids: string[]; updated_at: string }

/** Vínculo actual con Patreon, o null si no está conectado. */
export async function patreonLink(): Promise<PatreonLink | null> {
  const sb = supabase();
  if (!sb || !currentUser()) return null;
  const { data } = await sb.from('patreon_links').select('patron_status, tier_ids, updated_at').maybeSingle();
  return data;
}

async function call(body: Record<string, unknown>): Promise<any> {
  const sb = supabase();
  if (!sb) throw new Error('La nube no está configurada');
  const { data, error } = await sb.functions.invoke('patreon-connect', { body });
  if (error) {
    // el mensaje útil viene en el cuerpo de la respuesta de la función
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detail?.error || error.message);
  }
  return data;
}

/** Manda al usuario a Patreon para autorizar; al terminar vuelve a esta misma página. */
export async function connectPatreon(): Promise<void> {
  const { url } = await call({ action: 'connect', returnTo: location.origin + location.pathname });
  location.href = url;
}

export async function disconnectPatreon(): Promise<void> {
  await call({ action: 'disconnect' });
}

const MOTIVOS: Record<string, string> = {
  ya_vinculada: 'Esa cuenta de Patreon ya está vinculada a otro usuario.',
  estado_vencido: 'El enlace caducó. Vuelve a intentarlo.',
  sin_estado: 'El regreso de Patreon llegó incompleto. Vuelve a intentarlo.',
  patreon: 'Patreon no respondió como se esperaba. Inténtalo de nuevo en un momento.',
};

/** Lee y limpia el resultado que deja Patreon en la URL (?patreon=ok|cancelado|error&motivo=…). */
export function takePatreonReturn(): { status: 'ok' | 'cancelado' | 'error'; message: string } | null {
  const u = new URL(location.href), status = u.searchParams.get('patreon');
  if (!status) return null;
  const motivo = u.searchParams.get('motivo') || '';
  u.searchParams.delete('patreon'); u.searchParams.delete('motivo');
  history.replaceState(null, '', u.toString());
  if (status === 'ok') return { status, message: 'Patreon conectado. ¡Gracias por tu apoyo!' };
  if (status === 'cancelado') return { status, message: 'Conexión con Patreon cancelada.' };
  return { status: 'error', message: MOTIVOS[motivo] || 'No se pudo conectar con Patreon.' };
}
