// Cálculo del plan a partir de una membresía de Patreon. Sin dependencias de Deno: también se prueba con Vitest.

/** Nivel de Patreon → plan de la app, ordenados de menor a mayor. Viene del secreto PATREON_TIERS. */
export interface TierRule { id: string; tier: string }

export interface PatreonMember {
  patron_status?: string | null;          // 'active_patron' | 'declined_patron' | 'former_patron' | null
  next_charge_date?: string | null;
  campaign_id?: string | null;
  tier_ids: string[];
}

export interface Entitlement { tier: string; valid_until: string | null }

const DAY = 86_400_000;
/** Días de gracia después de la fecha de cobro, por si el webhook de renovación llega tarde. */
export const GRACE_DAYS = 3;

/** Lee y valida el secreto PATREON_TIERS: [{"id":"123","tier":"apoyo"},{"id":"456","tier":"pro"}]. */
export function parseTierRules(json: string | undefined): TierRule[] {
  if (!json) return [];
  const v = JSON.parse(json);
  if (!Array.isArray(v) || !v.every(r => r && typeof r.id === 'string' && typeof r.tier === 'string'))
    throw new Error('PATREON_TIERS debe ser una lista [{"id":"<id del nivel>","tier":"<plan>"}]');
  return v;
}

/**
 * Plan que le corresponde a un miembro: el más alto de sus niveles activos en tu campaña.
 * Si no paga (o es de otra campaña) queda en 'free'.
 */
export function entitlementFor(m: PatreonMember | null, campaignId: string, rules: TierRule[], now = Date.now()): Entitlement {
  const free: Entitlement = { tier: 'free', valid_until: null };
  if (!m || m.patron_status !== 'active_patron') return free;
  if (campaignId && m.campaign_id && m.campaign_id !== campaignId) return free;
  let best = -1;
  for (const id of m.tier_ids) best = Math.max(best, rules.findIndex(r => r.id === id));
  if (best < 0) return free;
  const charge = m.next_charge_date ? Date.parse(m.next_charge_date) : NaN;
  const until = Number.isFinite(charge) && charge > now ? charge + GRACE_DAYS * DAY : now + 35 * DAY;
  return { tier: rules[best].tier, valid_until: new Date(until).toISOString() };
}

type JsonApiRef = { id: string; type: string };
interface JsonApiResource { id: string; type: string; attributes?: Record<string, any>; relationships?: Record<string, { data: JsonApiRef | JsonApiRef[] | null }> }

const refs = (r: JsonApiResource | undefined, rel: string): JsonApiRef[] => {
  const d = r?.relationships?.[rel]?.data;
  return !d ? [] : Array.isArray(d) ? d : [d];
};
const toMember = (r: JsonApiResource): PatreonMember => ({
  patron_status: r.attributes?.patron_status ?? null,
  next_charge_date: r.attributes?.next_charge_date ?? null,
  campaign_id: refs(r, 'campaign')[0]?.id ?? null,
  tier_ids: refs(r, 'currently_entitled_tiers').map(t => t.id),
});

/** Respuesta de /api/oauth2/v2/identity (con include=memberships…) → id de Patreon y su membresía en tu campaña. */
export function memberFromIdentity(body: { data: JsonApiResource; included?: JsonApiResource[] }, campaignId: string): { patreonUserId: string; member: PatreonMember | null } {
  const members = (body.included || []).filter(r => r.type === 'member').map(toMember);
  const member = members.find(m => !campaignId || m.campaign_id === campaignId) || null;
  return { patreonUserId: body.data.id, member };
}

/** Cuerpo de un webhook de miembros → id de Patreon del usuario y su membresía. */
export function memberFromWebhook(body: { data: JsonApiResource }): { patreonUserId: string | null; member: PatreonMember } {
  return { patreonUserId: refs(body.data, 'user')[0]?.id ?? null, member: toMember(body.data) };
}
