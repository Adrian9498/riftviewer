import { describe, expect, it } from 'vitest';
import { isActive } from '../src/cloud/plan';

const NOW = 1_800_000_000_000;

describe('plan vigente', () => {
  it('Full Access vigente para el mismo usuario', () => {
    expect(isActive({ tier: 'full', validUntil: NOW + 1000, userId: 'u1' }, 'u1', NOW)).toBe(true);
    expect(isActive({ tier: 'full', validUntil: null, userId: 'u1' }, 'u1', NOW)).toBe(true);
  });
  it('no vale si venció, si es Gratis, sin sesión o si es de otro usuario', () => {
    expect(isActive({ tier: 'full', validUntil: NOW - 1, userId: 'u1' }, 'u1', NOW)).toBe(false);
    expect(isActive({ tier: 'free', validUntil: null, userId: 'u1' }, 'u1', NOW)).toBe(false);
    expect(isActive({ tier: 'full', validUntil: NOW + 1000, userId: 'u1' }, null, NOW)).toBe(false);
    expect(isActive({ tier: 'full', validUntil: NOW + 1000, userId: 'u1' }, 'u2', NOW)).toBe(false);
  });
});
