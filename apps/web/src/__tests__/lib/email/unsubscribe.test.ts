import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  makeUnsubscribeToken,
  verifyUnsubscribeToken,
  unsubscribeUrl,
  unsubscribeFooterHtml,
  type EmailCategory,
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

  const categories: EmailCategory[] = ["campaign", "action_plan", "property_alert"];

  it.each(categories)("round-trips the %s category", (category) => {
    const token = makeUnsubscribeToken("lead", "lead_123", category);
    expect(verifyUnsubscribeToken(token)).toEqual({
      kind: "lead",
      id: "lead_123",
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

  it("preserves an id containing a colon", () => {
    const token = makeUnsubscribeToken("user", "weird:id", "property_alert");
    expect(verifyUnsubscribeToken(token)).toEqual({
      kind: "user",
      id: "weird:id",
      category: "property_alert",
    });
  });
});
