import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { sealSecret, openSecret } from "@/lib/secret-box";

describe("secret-box", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_TOKEN_KEY", randomBytes(32).toString("base64"));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips", () => {
    expect(openSecret(sealSecret("hello refresh token"))).toBe("hello refresh token");
  });

  it("produces different output for the same text (random IV)", () => {
    expect(sealSecret("same")).not.toBe(sealSecret("same"));
  });

  it("has iv.tag.ciphertext format", () => {
    expect(sealSecret("x").split(".")).toHaveLength(3);
  });

  it("throws on tampered ciphertext", () => {
    const [iv, tag, ct] = sealSecret("secret").split(".");
    const buf = Buffer.from(ct, "base64url");
    buf[0] ^= 1;
    expect(() => openSecret(`${iv}.${tag}.${buf.toString("base64url")}`)).toThrow();
  });

  it("throws when key is unset", () => {
    vi.stubEnv("GOOGLE_TOKEN_KEY", "");
    expect(() => sealSecret("x")).toThrow(/GOOGLE_TOKEN_KEY/);
  });

  it("throws when key is the wrong length", () => {
    vi.stubEnv("GOOGLE_TOKEN_KEY", randomBytes(16).toString("base64"));
    expect(() => sealSecret("x")).toThrow(/32 bytes/);
  });

  it("throws on tampered auth tag", () => {
    const [iv, tag, ct] = sealSecret("secret").split(".");
    const buf = Buffer.from(tag, "base64url");
    buf[0] ^= 1;
    expect(() => openSecret(`${iv}.${buf.toString("base64url")}.${ct}`)).toThrow();
  });

  it("throws when opened with a different key", () => {
    const sealed = sealSecret("secret");
    vi.stubEnv("GOOGLE_TOKEN_KEY", randomBytes(32).toString("base64"));
    expect(() => openSecret(sealed)).toThrow();
  });

  it("throws on malformed input (not 3 parts)", () => {
    expect(() => openSecret("abc.def")).toThrow(/Malformed/);
    expect(() => openSecret("a.b.c.d")).toThrow(/Malformed/);
  });

  it("rejects a wrong-length IV", () => {
    const [, tag, ct] = sealSecret("secret").split(".");
    const badIv = randomBytes(16).toString("base64url");
    expect(() => openSecret(`${badIv}.${tag}.${ct}`)).toThrow(/Malformed/);
  });
});
