import { describe, it, expect, beforeAll } from "vitest";
import {
  makeUnsubscribeToken,
  verifyUnsubscribeToken,
  unsubscribeUrl,
} from "@/lib/email/unsubscribe";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret";
  process.env.NEXTAUTH_URL = "https://cncrealtygroup.com";
});

describe("unsubscribe tokens", () => {
  it("round-trips a lead token", () => {
    const t = makeUnsubscribeToken("lead", "lead_123");
    expect(verifyUnsubscribeToken(t)).toEqual({ kind: "lead", id: "lead_123" });
  });

  it("round-trips a user token", () => {
    const t = makeUnsubscribeToken("user", "user_456");
    expect(verifyUnsubscribeToken(t)).toEqual({ kind: "user", id: "user_456" });
  });

  it("rejects a tampered token", () => {
    const t = makeUnsubscribeToken("lead", "lead_123");
    expect(verifyUnsubscribeToken(t.slice(0, -1) + "0")).toBeNull();
  });

  it("rejects a token whose payload was swapped", () => {
    const a = makeUnsubscribeToken("lead", "lead_123");
    const b = makeUnsubscribeToken("lead", "lead_999");
    const forged = a.split(".")[0] + "." + b.split(".")[1];
    expect(verifyUnsubscribeToken(forged)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifyUnsubscribeToken("garbage")).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
  });

  it("builds an absolute unsubscribe url", () => {
    expect(unsubscribeUrl("lead", "lead_123")).toMatch(
      /^https:\/\/cncrealtygroup\.com\/unsubscribe\?t=/
    );
  });
});
