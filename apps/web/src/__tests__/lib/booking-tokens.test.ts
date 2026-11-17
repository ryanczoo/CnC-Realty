import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeManageToken, verifyManageToken, verifyRecruitToken } from "@/lib/booking/tokens";

// Fixed vector shared with the mailer's test (Task 16) — both sides must produce/accept this exact string.
const VECTOR = "eyJuIjoiSm9zw6kgTydOZWlsIiwiZSI6Impvc2VAZXhhbXBsZS5jb20ifQ.EHlY9TBG-FymaxTkIpkf-b4atGYN-3XM16B7Tc5QOO0";

describe("booking tokens", () => {
  beforeEach(() => {
    vi.stubEnv("BOOKING_LINK_SECRET", "test-recruit-secret");
    vi.stubEnv("NEXTAUTH_SECRET", "s");
  });
  it("reads the mailer's token", () => {
    expect(verifyRecruitToken(VECTOR)).toEqual({ firstName: "José", lastName: "O'Neil", email: "jose@example.com" });
  });
  it("rejects a tampered recruit token", () => {
    expect(verifyRecruitToken(VECTOR.replace("eyJu", "eyJv"))).toBeNull();
  });
  it("rejects when the recruit secret is not set", () => {
    vi.stubEnv("BOOKING_LINK_SECRET", "");
    expect(verifyRecruitToken(VECTOR)).toBeNull();
  });
  it("manage token round-trips and is not a recruit token", () => {
    const t = makeManageToken("bk_1");
    expect(verifyManageToken(t)).toBe("bk_1");
    expect(verifyRecruitToken(t)).toBeNull();
  });
  it("rejects garbage", () => { expect(verifyManageToken("abc")).toBeNull(); });
});
