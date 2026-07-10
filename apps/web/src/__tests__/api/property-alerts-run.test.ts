import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    savedSearch: { findMany: vi.fn() },
    property: { findMany: vi.fn() },
    propertyAlert: { createMany: vi.fn() },
  },
}));
vi.mock("@/lib/email/property-alert-email", () => ({
  sendPropertyAlertEmail: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { sendPropertyAlertEmail } from "@/lib/email/property-alert-email";
import { POST } from "../../app/api/property-alerts/run/route";

const SECRET = "test-sync-secret";

function makeRequest() {
  return new Request("http://localhost/api/property-alerts/run", {
    method: "POST",
    headers: { Authorization: `Bearer ${SECRET}` },
  });
}

const PROPERTY = (id: string) => ({
  id,
  mlsNumber: `MLS-${id}`,
  address: `${id} Main St`,
  city: "Pasadena",
  listPrice: 900000,
  photos: ["photo.jpg"],
});

describe("POST /api/property-alerts/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SYNC_SECRET = SECRET;
  });

  it("returns 401 when the bearer token is missing or wrong", async () => {
    const res = await POST(new Request("http://localhost/api/property-alerts/run", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("queries properties for each saved search independently", async () => {
    vi.mocked(prisma.savedSearch.findMany).mockResolvedValue([
      { id: "s1", userId: "u1", user: { id: "u1", email: "a@x.com", name: "A" }, alerts: [], minPrice: null, maxPrice: null, minBeds: null, minBaths: null, propertyType: null, cities: [], zips: [] },
      { id: "s2", userId: "u1", user: { id: "u1", email: "a@x.com", name: "A" }, alerts: [], minPrice: null, maxPrice: null, minBeds: null, minBaths: null, propertyType: null, cities: [], zips: [] },
    ] as any);
    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([PROPERTY("p1")] as any)
      .mockResolvedValueOnce([PROPERTY("p2")] as any);
    vi.mocked(prisma.propertyAlert.createMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(sendPropertyAlertEmail).mockResolvedValue(undefined as any);

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(2);
    expect(prisma.property.findMany).toHaveBeenCalledTimes(2);
    // Both searches belong to the same user — one combined email, not two
    expect(sendPropertyAlertEmail).toHaveBeenCalledTimes(1);
    expect(body.emailsSent).toBe(1);
  });

  it("skips properties already alerted for that saved search", async () => {
    vi.mocked(prisma.savedSearch.findMany).mockResolvedValue([
      { id: "s1", userId: "u1", user: { id: "u1", email: "a@x.com", name: "A" }, alerts: [{ propertyId: "p1" }], minPrice: null, maxPrice: null, minBeds: null, minBaths: null, propertyType: null, cities: [], zips: [] },
    ] as any);
    vi.mocked(prisma.property.findMany).mockResolvedValue([PROPERTY("p1")] as any);

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.emailsSent).toBe(0);
    expect(prisma.propertyAlert.createMany).not.toHaveBeenCalled();
    expect(sendPropertyAlertEmail).not.toHaveBeenCalled();
  });
});
