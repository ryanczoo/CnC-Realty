import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createHmac } from "crypto";
import {
  makeUnsubscribeToken,
  verifyUnsubscribeToken,
  unsubscribeUrl,
  unsubscribeFooterHtml,
  type EmailCategory,
  type OptOutKind,
} from "@/lib/email/unsubscribe";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret";
  process.env.NEXTAUTH_URL = "https://cncrealtygroup.com";
});

describe("unsubscribe tokens", () => {
  it("round-trips a lead token", () => {
    const t = makeUnsubscribeToken("lead", "lead_123", "campaign");
    expect(verifyUnsubscribeToken(t)).toEqual({
      kind: "lead",
      id: "lead_123",
      category: "campaign",
    });
  });

  it("round-trips a user token", () => {
    const t = makeUnsubscribeToken("user", "user_456", "property_alert");
    expect(verifyUnsubscribeToken(t)).toEqual({
      kind: "user",
      id: "user_456",
      category: "property_alert",
    });
  });

  it("rejects a tampered token", () => {
    const t = makeUnsubscribeToken("lead", "lead_123", "campaign");
    expect(verifyUnsubscribeToken(t.slice(0, -1) + "0")).toBeNull();
  });

  it("rejects a token whose payload was swapped", () => {
    const a = makeUnsubscribeToken("lead", "lead_123", "campaign");
    const b = makeUnsubscribeToken("lead", "lead_999", "campaign");
    const forged = a.split(".")[0] + "." + b.split(".")[1];
    expect(verifyUnsubscribeToken(forged)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifyUnsubscribeToken("garbage")).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
  });

  it("builds an absolute unsubscribe url", () => {
    expect(unsubscribeUrl("lead", "lead_123", "campaign")).toMatch(
      /^https:\/\/cncrealtygroup\.com\/unsubscribe\?t=/
    );
  });
});

describe("unsubscribeFooterHtml", () => {
  it("embeds a working unsubscribe link for the recipient", () => {
    const html = unsubscribeFooterHtml("lead", "lead_123", "campaign");
    const href = html.match(/href="([^"]+)"/)?.[1];

    expect(href).toBeDefined();
    // The link has to round-trip: a footer pointing at a token the endpoint
    // rejects is a compliance failure that looks fine to the eye.
    const token = new URL(href!).searchParams.get("t");
    expect(verifyUnsubscribeToken(token!)).toEqual({
      kind: "lead",
      id: "lead_123",
      category: "campaign",
    });
  });

  it("builds a distinct link per recipient", () => {
    expect(unsubscribeFooterHtml("lead", "lead_1", "campaign")).not.toBe(
      unsubscribeFooterHtml("lead", "lead_2", "campaign")
    );
  });
});

describe("category-carrying unsubscribe token", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret";
  });

  // Each category paired with the kind CATEGORY_KIND maps it to. Minting every
  // category against "lead" — as this table used to — asserted the very
  // invariant violation the kind/category cross-check exists to reject:
  // property_alert belongs to a user, and a lead:property_alert token is
  // exactly the mismatch that would read and write the wrong column.
  const pairs: [OptOutKind, EmailCategory][] = [
    ["lead", "campaign"],
    ["lead", "action_plan"],
    ["user", "property_alert"],
  ];

  it.each(pairs)("round-trips a %s token carrying the %s category", (kind, category) => {
    const token = makeUnsubscribeToken(kind, "recipient_123", category);
    expect(verifyUnsubscribeToken(token)).toEqual({
      kind,
      id: "recipient_123",
      category,
    });
  });

  it("rejects a token whose signature was tampered with", () => {
    const token = makeUnsubscribeToken("lead", "lead_123", "campaign");
    const [payload] = token.split(".");
    expect(verifyUnsubscribeToken(`${payload}.deadbeef`)).toBeNull();
  });

  it("rejects a category that is not one of the three known values", () => {
    // Signed correctly, so this passes the HMAC check and can only be caught
    // by validating the category itself.
    const forged = makeUnsubscribeToken("lead", "lead_123", "newsletter" as EmailCategory);
    expect(verifyUnsubscribeToken(forged)).toBeNull();
  });

  it("rejects a token with no category segment", () => {
    expect(verifyUnsubscribeToken("bm90LWEtdG9rZW4.sig")).toBeNull();
  });

  // makeUnsubscribeToken cannot produce either of the payloads below — it
  // always writes three segments, and always pairs kind with category
  // correctly. Signing by hand is the only way to reach these branches, which
  // is exactly why they went uncovered.
  function handSign(rawPayload: string): string {
    const payload = Buffer.from(rawPayload).toString("base64url");
    const sig = createHmac("sha256", process.env.NEXTAUTH_SECRET!)
      .update(payload)
      .digest("base64url");
    return `${payload}.${sig}`;
  }

  it("rejects a validly-signed token whose kind and category disagree", () => {
    // Passes the HMAC check and names a real category, so only the
    // kind/category cross-check can catch it. Left unguarded, this reads and
    // writes campaignOptOut — the wrong column entirely.
    expect(verifyUnsubscribeToken(handSign("lead:lead_123:property_alert"))).toBeNull();
    expect(verifyUnsubscribeToken(handSign("user:user_456:campaign"))).toBeNull();
  });

  it("rejects a validly-signed payload with fewer than three segments", () => {
    expect(verifyUnsubscribeToken(handSign("lead:lead_123"))).toBeNull();
  });

  it("still accepts a hand-signed payload that pairs correctly", () => {
    // Guards the two tests above: proves they fail on the mismatch itself, not
    // because handSign produces something the verifier rejects outright.
    expect(verifyUnsubscribeToken(handSign("lead:lead_123:campaign"))).toEqual({
      kind: "lead",
      id: "lead_123",
      category: "campaign",
    });
  });

  it("preserves an id containing a colon", () => {
    const token = makeUnsubscribeToken("user", "weird:id", "property_alert");
    expect(verifyUnsubscribeToken(token)).toEqual({
      kind: "user",
      id: "weird:id",
      category: "property_alert",
    });
  });
});
