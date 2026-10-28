// POST (con la sesión del usuario):
//   { action: 'connect', returnTo }  → { url } para mandar al usuario a autorizar en Patreon
//   { action: 'disconnect' }         → quita el vínculo y vuelve al plan gratis
import { PATREON, admin, appOrigins, callbackUrl, cors, env, json } from '../_shared/server.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    const db = admin();
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user }, error } = await db.auth.getUser(jwt);
    if (error || !user) return json({ error: 'Sesión no válida' }, 401);
    const { action, returnTo } = await req.json().catch(() => ({}));

    if (action === 'disconnect') {
      await db.from('patreon_links').delete().eq('user_id', user.id);
      await db.from('entitlements').upsert({ user_id: user.id, tier: 'free', source: null, valid_until: null, updated_at: new Date().toISOString() });
      return json({ ok: true });
    }

    if (action !== 'connect') return json({ error: 'Acción desconocida' }, 400);
    let origin = '';
    try { origin = new URL(String(returnTo)).origin; } catch { /* no es una URL */ }
    if (!appOrigins().includes(origin)) return json({ error: 'Dirección de regreso no permitida' }, 400);

    // estado de un solo uso que liga el regreso de Patreon con este usuario
    const state = crypto.randomUUID() + crypto.randomUUID().replaceAll('-', '');
    await db.from('patreon_oauth_states').delete().lt('created_at', new Date(Date.now() - 3_600_000).toISOString());
    const ins = await db.from('patreon_oauth_states').insert({ state, user_id: user.id, return_to: String(returnTo) });
    if (ins.error) throw new Error(ins.error.message);

    const url = new URL(PATREON.authorize);
    url.search = new URLSearchParams({
      response_type: 'code', client_id: env('PATREON_CLIENT_ID'), redirect_uri: callbackUrl(),
      scope: 'identity identity.memberships', state,
    }).toString();
    return json({ url: url.toString() });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
