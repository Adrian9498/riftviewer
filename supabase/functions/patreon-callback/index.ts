// GET: Patreon devuelve aquí al usuario después de autorizar (sin sesión de Supabase).
// Se valida con el "state" de un solo uso, se consulta su membresía y se actualiza su plan.
// Al final vuelve a la app con ?patreon=ok | cancelado | error&motivo=…
import { memberFromIdentity, entitlementFor } from '../_shared/tiers.ts';
import { PATREON, admin, appOrigins, callbackUrl, campaignId, env, saveLink, tierRules } from '../_shared/server.ts';

const STATE_MAX_AGE = 15 * 60_000;

function back(to: string, status: string, motivo?: string): Response {
  const u = new URL(to);
  u.searchParams.set('patreon', status);
  if (motivo) u.searchParams.set('motivo', motivo);
  return new Response(null, { status: 303, headers: { Location: u.toString() } });
}

Deno.serve(async req => {
  const q = new URL(req.url).searchParams;
  const fallback = appOrigins()[0] + '/';
  const state = q.get('state');
  if (!state) return back(fallback, 'error', 'sin_estado');

  const db = admin();
  const { data: st } = await db.from('patreon_oauth_states').delete().eq('state', state).select().maybeSingle();
  if (!st || Date.now() - Date.parse(st.created_at) > STATE_MAX_AGE) return back(fallback, 'error', 'estado_vencido');
  const code = q.get('code');
  if (q.get('error') || !code) return back(st.return_to, 'cancelado');

  try {
    const tok = await fetch(PATREON.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code, redirect_uri: callbackUrl(),
        client_id: env('PATREON_CLIENT_ID'), client_secret: env('PATREON_CLIENT_SECRET'),
      }),
    });
    if (!tok.ok) throw new Error(`Patreon rechazó el código (${tok.status}): ${await tok.text()}`);
    const { access_token } = await tok.json();

    const idr = await fetch(PATREON.identity, { headers: { Authorization: `Bearer ${access_token}` } });
    if (!idr.ok) throw new Error(`No se pudo leer la membresía (${idr.status}): ${await idr.text()}`);
    const { patreonUserId, member } = memberFromIdentity(await idr.json(), campaignId());

    // una cuenta de Patreon solo puede estar vinculada a un usuario de la app
    const { data: other } = await db.from('patreon_links').select('user_id').eq('patreon_user_id', patreonUserId).maybeSingle();
    if (other && other.user_id !== st.user_id) return back(st.return_to, 'error', 'ya_vinculada');

    await saveLink(db, st.user_id, patreonUserId, member, entitlementFor(member, campaignId(), tierRules()));
    return back(st.return_to, 'ok');
  } catch (e) {
    console.error(e);
    return back(st.return_to, 'error', 'patreon');
  }
});
