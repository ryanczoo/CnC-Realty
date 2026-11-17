import { createHmac, timingSafeEqual } from "crypto";

// Token = base64url(data) + "." + base64url(HMAC-SHA256 over the base64url payload).
// Stateless, so a link can live in an inbox indefinitely.
function hmac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signPayload(data: string, secret: string): string {
  const payload = Buffer.from(data).toString("base64url");
  return `${payload}.${hmac(payload, secret)}`;
}

export function verifySignedPayload(token: string, secret: string): string | null {
  if (!secret) return null;
  const parts = (token ?? "").split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;

  const expected = Buffer.from(hmac(payload, secret));
  const given = Buffer.from(sig);
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  return Buffer.from(payload, "base64url").toString();
}
