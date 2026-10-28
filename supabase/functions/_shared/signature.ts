// Verificación de la firma de los webhooks de Patreon: X-Patreon-Signature = HMAC-MD5(cuerpo, secreto) en hex.
import { Buffer } from 'node:buffer';
import { createHmac, timingSafeEqual } from 'node:crypto';

export function patreonSignature(body: string, secret: string): string {
  return createHmac('md5', secret).update(body, 'utf8').digest('hex');
}

export function verifyPatreonSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = Buffer.from(patreonSignature(body, secret), 'hex');
  const got = Buffer.from(signature.trim().toLowerCase(), 'hex');
  return got.length === expected.length && timingSafeEqual(got, expected);
}
