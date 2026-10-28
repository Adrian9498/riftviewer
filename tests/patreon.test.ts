import { describe, expect, it } from 'vitest';
import { entitlementFor, memberFromIdentity, memberFromWebhook, parseTierRules } from '../supabase/functions/_shared/tiers';
import { patreonSignature, verifyPatreonSignature } from '../supabase/functions/_shared/signature';

const rules = parseTierRules('[{"id":"t1","tier":"apoyo"},{"id":"t2","tier":"pro"}]');
const NOW = Date.parse('2026-10-28T00:00:00Z');

describe('plan según Patreon', () => {
  it('toma el nivel más alto de los que paga y vence después de la fecha de cobro', () => {
    const e = entitlementFor({ patron_status: 'active_patron', campaign_id: 'c1', tier_ids: ['t1', 't2'], next_charge_date: '2026-11-15T00:00:00Z' }, 'c1', rules, NOW);
    expect(e.tier).toBe('pro');
    expect(e.valid_until).toBe('2026-11-18T00:00:00.000Z');   // + 3 días de gracia
  });

  it('sin fecha de cobro, da 35 días', () => {
    const e = entitlementFor({ patron_status: 'active_patron', campaign_id: 'c1', tier_ids: ['t1'] }, 'c1', rules, NOW);
    expect(e).toEqual({ tier: 'apoyo', valid_until: new Date(NOW + 35 * 86_400_000).toISOString() });
  });

  it.each([
    ['no paga', { patron_status: 'declined_patron', campaign_id: 'c1', tier_ids: ['t2'] }],
    ['ya no es miembro', { patron_status: 'former_patron', campaign_id: 'c1', tier_ids: [] }],
    ['es de otra campaña', { patron_status: 'active_patron', campaign_id: 'otra', tier_ids: ['t2'] }],
    ['su nivel no está en la lista', { patron_status: 'active_patron', campaign_id: 'c1', tier_ids: ['gratis-de-patreon'] }],
  ])('queda en gratis si %s', (_, m) => {
    expect(entitlementFor(m, 'c1', rules, NOW)).toEqual({ tier: 'free', valid_until: null });
  });

  it('valida el formato de PATREON_TIERS', () => {
    expect(parseTierRules(undefined)).toEqual([]);
    expect(() => parseTierRules('{"t1":"pro"}')).toThrow('PATREON_TIERS');
  });
});

describe('lectura de respuestas de Patreon', () => {
  const member = (campaign: string, tiers: string[]) => ({
    id: 'm-' + campaign, type: 'member', attributes: { patron_status: 'active_patron', next_charge_date: null },
    relationships: { campaign: { data: { id: campaign, type: 'campaign' } }, currently_entitled_tiers: { data: tiers.map(id => ({ id, type: 'tier' })) }, user: { data: { id: 'u9', type: 'user' } } },
  });

  it('identity: elige la membresía de tu campaña', () => {
    const r = memberFromIdentity({ data: { id: 'u9', type: 'user' }, included: [member('otra', ['x']), member('c1', ['t2']), { id: 't2', type: 'tier' }] }, 'c1');
    expect(r.patreonUserId).toBe('u9');
    expect(r.member).toEqual({ patron_status: 'active_patron', next_charge_date: null, campaign_id: 'c1', tier_ids: ['t2'] });
  });

  it('identity: sin membresía en tu campaña', () => {
    expect(memberFromIdentity({ data: { id: 'u9', type: 'user' }, included: [member('otra', ['x'])] }, 'c1').member).toBeNull();
  });

  it('webhook: id del usuario y niveles', () => {
    const r = memberFromWebhook({ data: member('c1', ['t1']) });
    expect(r.patreonUserId).toBe('u9');
    expect(r.member.tier_ids).toEqual(['t1']);
  });
});

describe('firma de webhooks', () => {
  it('acepta la firma correcta y rechaza cualquier cambio', () => {
    const body = '{"data":{"id":"m1"}}', sig = patreonSignature(body, 'secreto');
    expect(verifyPatreonSignature(body, sig, 'secreto')).toBe(true);
    expect(verifyPatreonSignature(body, sig.toUpperCase(), 'secreto')).toBe(true);
    expect(verifyPatreonSignature(body + ' ', sig, 'secreto')).toBe(false);
    expect(verifyPatreonSignature(body, sig, 'otro')).toBe(false);
    expect(verifyPatreonSignature(body, null, 'secreto')).toBe(false);
    expect(verifyPatreonSignature(body, 'zz', 'secreto')).toBe(false);
  });
});
