import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

describe("isAuthorizedCronRequest", () => {
  const ORIGINAL = process.env.CRON_SECRET;
  afterEach(() => { process.env.CRON_SECRET = ORIGINAL; });

  it("returns false when CRON_SECRET is not set, even if the header says 'Bearer undefined'", () => {
    delete process.env.CRON_SECRET;
    const req = new Request("http://localhost", { headers: { authorization: "Bearer undefined" } });
    expect(isAuthorizedCronRequest(req)).toBe(false);
  });

  it("returns true when the header matches the configured secret", () => {
    process.env.CRON_SECRET = "real-secret";
    const req = new Request("http://localhost", { headers: { authorization: "Bearer real-secret" } });
    expect(isAuthorizedCronRequest(req)).toBe(true);
  });

  it("returns false when the header doesn't match", () => {
    process.env.CRON_SECRET = "real-secret";
    const req = new Request("http://localhost", { headers: { authorization: "Bearer wrong" } });
    expect(isAuthorizedCronRequest(req)).toBe(false);
  });
});
