// Utilidades comunes de las Edge Functions de Patreon (Deno).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { parseTierRules, type Entitlement, type PatreonMember, type TierRule } from './tiers.ts';

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Falta el secreto ${name} (npx supabase secrets set ${name}=...)`);
  return v;
}

/** Cliente con permisos de servidor (service_role, lo inyecta Supabase en las Edge Functions). */
export const admin = (): SupabaseClient =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });

export const PATREON = {
  authorize: 'https://www.patreon.com/oauth2/authorize',
  token: 'https://www.patreon.com/api/oauth2/token',
  identity: 'https://www.patreon.com/api/oauth2/v2/identity?include=memberships,memberships.currently_entitled_tiers,memberships.campaign'
    + '&fields%5Bmember%5D=patron_status,next_charge_date',
};
export const callbackUrl = () => `${env('SUPABASE_URL')}/functions/v1/patreon-callback`;
export const campaignId = () => env('PATREON_CAMPAIGN_ID');
export const tierRules = (): TierRule[] => parseTierRules(env('PATREON_TIERS'));

/** Orígenes de la app a los que se puede volver (secreto APP_URLS, separados por coma). */
export const appOrigins = (): string[] => env('APP_URLS').split(',').map(s => new URL(s.trim()).origin);

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

/** Guarda el vínculo con Patreon y el plan resultante. */
export async function saveLink(db: SupabaseClient, userId: string, patreonUserId: string, member: PatreonMember | null, ent: Entitlement) {
  const now = new Date().toISOString();
  check(await db.from('patreon_links').upsert({
    user_id: userId, patreon_user_id: patreonUserId, patron_status: member?.patron_status ?? null, tier_ids: member?.tier_ids ?? [], updated_at: now,
  }));
  check(await db.from('entitlements').upsert({ user_id: userId, tier: ent.tier, source: 'patreon', valid_until: ent.valid_until, updated_at: now }));
}
