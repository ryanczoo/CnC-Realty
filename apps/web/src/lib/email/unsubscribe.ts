import { createHmac, timingSafeEqual } from "crypto";

export type OptOutKind = "lead" | "user";

export type EmailCategory = "campaign" | "action_plan" | "property_alert";

const CATEGORIES: readonly string[] = ["campaign", "action_plan", "property_alert"];

// Which table each category's recipient lives in. Users only ever receive
// property alerts; leads receive campaigns and drips.
export const CATEGORY_KIND: Record<EmailCategory, OptOutKind> = {
  campaign: "lead",
  action_plan: "lead",
  property_alert: "user",
};

// Signed rather than a stored random token: an unsubscribe link has to survive
// in an inbox indefinitely, and this needs no table, no lookup, and no cleanup.
function sign(payload: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function makeUnsubscribeToken(
  kind: OptOutKind,
  id: string,
  category: EmailCategory
): string {
  const payload = Buffer.from(`${kind}:${id}:${category}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyUnsubscribeToken(
  token: string
): { kind: OptOutKind; id: string; category: EmailCategory } | null {
  const [payload, sig] = (token ?? "").split(".");
  if (!payload || !sig) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  // Length check first: timingSafeEqual throws on a length mismatch rather
  // than returning false.
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }

  // kind is the first segment and category the last, so the id in between may
  // itself contain colons. A cuid never does, but this keeps the parse correct
  // if id formats ever change.
  const parts = Buffer.from(payload, "base64url").toString().split(":");
  if (parts.length < 3) return null;

  const kind = parts[0];
  const category = parts[parts.length - 1];
  const id = parts.slice(1, -1).join(":");

  if (kind !== "lead" && kind !== "user") return null;
  if (!id) return null;
  // A signed but unknown category is still a refusal: defaulting would opt the
  // recipient out of something they did not ask to leave.
  if (!CATEGORIES.includes(category)) return null;

  return { kind, id, category: category as EmailCategory };
}

// Human-facing: a page with a confirm button. Used for the footer link.
export function unsubscribeUrl(kind: OptOutKind, id: string, category: EmailCategory): string {
  return `${process.env.NEXTAUTH_URL}/unsubscribe?t=${makeUnsubscribeToken(kind, id, category)}`;
}

// Machine-facing: the List-Unsubscribe header target. RFC 8058 one-click has
// the mail client POST here directly with a form-encoded body, so it must be
// the API route rather than the page — a POST to the page would 405, and the
// header would be advertising a capability that does not work.
export function unsubscribePostUrl(kind: OptOutKind, id: string, category: EmailCategory): string {
  return `${process.env.NEXTAUTH_URL}/api/unsubscribe?t=${makeUnsubscribeToken(kind, id, category)}`;
}

// The List-Unsubscribe header is not sufficient on its own: only some clients
// surface it, and CAN-SPAM requires a visible opt-out inside the message. Every
// broadcast body appends this.
export function unsubscribeFooterHtml(
  kind: OptOutKind,
  id: string,
  category: EmailCategory
): string {
  return `<p style="margin:24px 0 0;font-size:12px;color:#999999;">Don&rsquo;t want these emails? <a href="${unsubscribeUrl(kind, id, category)}" style="color:#9E8C61;">Unsubscribe</a></p>`;
}
