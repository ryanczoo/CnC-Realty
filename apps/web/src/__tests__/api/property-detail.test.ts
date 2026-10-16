import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: { findUnique: vi.fn() },
    siteSettings: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "../../app/api/properties/[mlsNumber]/route";

describe("GET /api/properties/[mlsNumber]", () => {
  beforeEach(() => vi.clearAllMocks());

  // The drawer's CRMLS line shows when the feed was last pulled, not when this
  // one listing was first inserted.
  it("includes the feed's last sync time alongside the listing", async () => {
    vi.mocked(prisma.property.findUnique).mockResolvedValue({ mlsNumber: "ML1", address: "1 Main St" } as any);
    vi.mocked(prisma.siteSettings.findUnique).mockResolvedValue({
      key: "idx_last_sync_at",
      value: "2026-10-16T15:00:00.000Z",
    } as any);

    const res = await GET(new Request("http://localhost/api/properties/ML1"), { params: { mlsNumber: "ML1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mlsNumber).toBe("ML1");
    expect(body.lastSyncAt).toBe("2026-10-16T15:00:00.000Z");
  });

  it("returns a null last sync time before any sync has finished", async () => {
    vi.mocked(prisma.property.findUnique).mockResolvedValue({ mlsNumber: "ML1" } as any);
    vi.mocked(prisma.siteSettings.findUnique).mockResolvedValue(null);

    const body = await (await GET(new Request("http://localhost/api/properties/ML1"), { params: { mlsNumber: "ML1" } })).json();
    expect(body.lastSyncAt).toBeNull();
  });
});
