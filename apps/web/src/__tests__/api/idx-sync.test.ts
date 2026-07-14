import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { property: { upsert: vi.fn() } },
}));
vi.mock("@/lib/idx/client", () => ({
  fetchProperties: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { fetchProperties } from "@/lib/idx/client";
import { GET } from "../../app/api/idx/sync/route";

function makeRequest(secret: string) {
  return new Request("http://localhost/api/idx/sync?type=delta", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/idx/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it("skips upserting a Closed FOR_RENT record but keeps Active FOR_RENT and Closed FOR_SALE", async () => {
    vi.mocked(fetchProperties).mockImplementation(async function* () {
      yield [
        { mlsNumber: "ML1", status: "Closed", listingType: "FOR_RENT" } as any,
        { mlsNumber: "ML2", status: "Active", listingType: "FOR_RENT" } as any,
        { mlsNumber: "ML3", status: "Closed", listingType: "FOR_SALE" } as any,
      ];
    });

    const res = await GET(makeRequest("test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.upserted).toBe(2);

    expect(prisma.property.upsert).toHaveBeenCalledTimes(2);
    const upsertedIds = vi.mocked(prisma.property.upsert).mock.calls.map(
      (call) => (call[0] as any).where.mlsNumber
    );
    expect(upsertedIds).toEqual(["ML2", "ML3"]);
  });
});
