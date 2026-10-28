// POST desde Patreon cuando alguien se une, cambia de nivel, paga o cancela.
// Eventos a activar en Patreon: members:create, members:update, members:delete,
// members:pledge:create, members:pledge:update, members:pledge:delete.
import { entitlementFor, memberFromWebhook } from '../_shared/tiers.ts';
import { verifyPatreonSignature } from '../_shared/signature.ts';
import { admin, campaignId, env, saveLink, tierRules } from '../_shared/server.ts';

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 });
  const body = await req.text();
  if (!verifyPatreonSignature(body, req.headers.get('X-Patreon-Signature'), env('PATREON_WEBHOOK_SECRET')))
    return new Response('Firma inválida', { status: 401 });

  try {
    const { patreonUserId, member } = memberFromWebhook(JSON.parse(body));
    // respuestas 200 aunque no aplique: si no, Patreon reintenta y termina desactivando el webhook
    if (!patreonUserId) return new Response('Sin usuario');
    const db = admin();
    const { data: link } = await db.from('patreon_links').select('user_id').eq('patreon_user_id', patreonUserId).maybeSingle();
    if (!link) return new Response('Usuario sin vincular');
    await saveLink(db, link.user_id, patreonUserId, member, entitlementFor(member, campaignId(), tierRules()));
    console.log(`${req.headers.get('X-Patreon-Event')}: ${patreonUserId}`);
    return new Response('ok');
  } catch (e) {
    console.error(e);
    return new Response('Error', { status: 500 });   // Patreon reintentará
  }
});
