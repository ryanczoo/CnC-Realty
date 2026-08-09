import { timingSafeEqual } from "crypto";

/**
 * Postmark authenticates webhooks with HTTP Basic Auth embedded in the endpoint
 * URL you register, not a signed payload the way SendGrid did. Shared by the
 * event and inbound routes so the two cannot drift apart.
 *
 * Fails closed when the credentials are unset: an unconfigured deploy rejects
 * everything rather than accepting anything.
 */
export function isAuthorizedPostmarkWebhook(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const user = process.env.POSTMARK_WEBHOOK_USER;
  const pass = process.env.POSTMARK_WEBHOOK_PASSWORD;
  if (!user || !pass) return false;

  const expected = Buffer.from("Basic " + Buffer.from(`${user}:${pass}`).toString("base64"));
  const given = Buffer.from(header);
  // Length check first: timingSafeEqual throws on a length mismatch.
  return expected.length === given.length && timingSafeEqual(expected, given);
}
