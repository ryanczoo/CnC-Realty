import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/listing-counts", () => ({ refreshListingCounts: vi.fn() }));

import { GET, POST } from "@/app/api/cron/listing-counts/route";
import { refreshListingCounts } from "@/lib/listing-counts";

const validSecret = "test-secret";

const makeReq = (secret?: string) =>
  new NextRequest("http://localhost/api/cron/listing-counts", {
    method: "GET",
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });

describe("/api/cron/listing-counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", validSecret);
  });

  it("returns 401 with the wrong secret and refreshes nothing", async () => {
    const res = await GET(makeReq("wrong"));
    expect(res.status).toBe(401);
    expect(refreshListingCounts).not.toHaveBeenCalled();
  });

  it("refreshes the saved counts and reports what it saved", async () => {
    vi.mocked(refreshListingCounts).mockResolvedValue({ cities: 1193, searches: 7 });
    const res = await GET(makeReq(validSecret));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cities: 1193, searches: 7 });
    expect(refreshListingCounts).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when the refresh fails, leaving the old saved counts in place", async () => {
    vi.mocked(refreshListingCounts).mockRejectedValue(new Error("db down"));
    const res = await POST(makeReq(validSecret));
    expect(res.status).toBe(500);
  });
});
