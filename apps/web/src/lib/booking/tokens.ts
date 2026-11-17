import { signPayload, verifySignedPayload } from "@/lib/signed-token";

const MANAGE_PREFIX = "booking:";

function nextAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return secret;
}

export function makeManageToken(bookingId: string): string {
  return signPayload(`${MANAGE_PREFIX}${bookingId}`, nextAuthSecret());
}

export function verifyManageToken(t: string): string | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  const data = verifySignedPayload(t, secret);
  if (!data || !data.startsWith(MANAGE_PREFIX)) return null;
  const id = data.slice(MANAGE_PREFIX.length);
  return id || null;
}

export function manageUrl(bookingId: string): string {
  return `${process.env.NEXTAUTH_URL}/booking/manage?t=${makeManageToken(bookingId)}`;
}

// Issued by the recruiting mailer; payload is JSON {n: full name, e: email}.
export function verifyRecruitToken(
  t: string
): { firstName: string; lastName: string; email: string } | null {
  const secret = process.env.BOOKING_LINK_SECRET;
  if (!secret) return null;
  const data = verifySignedPayload(t, secret);
  if (!data) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const { n, e } = parsed as { n?: unknown; e?: unknown };
  if (typeof n !== "string" || typeof e !== "string" || !n.trim() || !e) return null;
  const words = n.trim().split(/\s+/);
  return { firstName: words[0], lastName: words.slice(1).join(" "), email: e };
}
