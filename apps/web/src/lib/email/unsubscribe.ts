import { createHmac, timingSafeEqual } from "crypto";

export type OptOutKind = "lead" | "user";

// Signed rather than a stored random token: an unsubscribe link has to survive
// in an inbox indefinitely, and this needs no table, no lookup, and no cleanup.
function sign(payload: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function makeUnsubscribeToken(kind: OptOutKind, id: string): string {
  const payload = Buffer.from(`${kind}:${id}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyUnsubscribeToken(
  token: string
): { kind: OptOutKind; id: string } | null {
  const [payload, sig] = (token ?? "").split(".");
  if (!payload || !sig) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  // Length check first: timingSafeEqual throws on a length mismatch rather
  // than returning false.
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }

  // Split on the first colon only — a cuid never contains one, but rejoining
  // the remainder keeps this correct if id formats ever change.
  const [kind, ...rest] = Buffer.from(payload, "base64url").toString().split(":");
  const id = rest.join(":");
  if ((kind !== "lead" && kind !== "user") || !id) return null;
  return { kind, id };
}

export function unsubscribeUrl(kind: OptOutKind, id: string): string {
  return `${process.env.NEXTAUTH_URL}/unsubscribe?t=${makeUnsubscribeToken(kind, id)}`;
}
