import { describe, it, expect, vi, beforeEach } from "vitest";

// React's `cache()` is a react-server-only export; stub it as a pass-through
// (same approach as AgentProfilePage.test.ts).
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: (fn: unknown) => fn,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { property: { findUnique: vi.fn() } },
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/idx/last-sync", () => ({ getIdxLastSyncAt: vi.fn() }));
vi.mock("@/components/properties/PhotoGallery", () => ({ PhotoGallery: () => null }));
vi.mock("@/components/properties/MortgageCalculator", () => ({ MortgageCalculator: () => null }));
vi.mock("@/components/properties/ContactForm", () => ({ ContactForm: () => null }));
vi.mock("@/components/properties/BackLink", () => ({ BackLink: () => null }));
vi.mock("@/components/properties/AgentAttribution", () => ({ AgentAttribution: () => null }));
vi.mock("@/components/properties/CrmlsDisclaimer", () => ({ CrmlsDisclaimer: () => null }));
vi.mock("@/components/properties/SaveButton", () => ({ SaveButton: () => null }));
vi.mock("@/components/properties/StickyContactBar", () => ({ StickyContactBar: () => null }));

import { prisma } from "@/lib/prisma";
import { generateMetadata } from "../../app/(listings)/properties/[mlsNumber]/page";

const PROPERTY = {
  mlsNumber: "1149821494",
  address: "123 Main St",
  city: "Pasadena",
  state: "CA",
  zip: "91101",
  listPrice: 850_000,
  description: null,
  photos: ["https://cdn.example.com/first.jpg", "https://cdn.example.com/second.jpg"],
  status: "Active",
} as any;

async function metaFor(overrides: Record<string, unknown> = {}) {
  vi.mocked(prisma.property.findUnique).mockResolvedValue({ ...PROPERTY, ...overrides });
  return generateMetadata({ params: { mlsNumber: "1149821494" } });
}

describe("listing generateMetadata", () => {
  beforeEach(() => vi.clearAllMocks());

  it("titles an active listing with the full address and canonicalises its URL", async () => {
    const meta = await metaFor();
    expect(meta.title).toBe("123 Main St, Pasadena, CA 91101");
    expect(meta.alternates?.canonical).toBe("/properties/1149821494");
    expect(meta).not.toHaveProperty("robots");
  });

  it("uses the first listing photo as the preview image", async () => {
    const meta = await metaFor();
    expect(meta.openGraph?.images).toEqual([
      { url: "https://cdn.example.com/first.jpg", width: 1200, height: 630 },
    ]);
  });

  it("falls back to the default preview image when there are no photos", async () => {
    const meta = await metaFor({ photos: [] });
    expect(meta.openGraph?.images).toEqual([
      expect.objectContaining({ url: "/og-default.jpg" }),
    ]);
  });

  it("keeps the MLS description, else builds one from the new title", async () => {
    expect((await metaFor({ description: "Charming bungalow." })).description).toBe("Charming bungalow.");
    expect((await metaFor()).description).toBe("123 Main St, Pasadena, CA 91101 — $850,000");
  });

  it("keeps ComingSoon and ActiveUnderContract listings indexable", async () => {
    for (const status of ["ComingSoon", "ActiveUnderContract"]) {
      expect(await metaFor({ status })).not.toHaveProperty("robots");
    }
  });

  it("hides Closed and Pending listings from Google but lets crawlers follow links", async () => {
    for (const status of ["Closed", "Pending"]) {
      expect((await metaFor({ status })).robots).toEqual({ index: false, follow: true });
    }
  });

  it("keeps simple titles on the not-found and error branches", async () => {
    vi.mocked(prisma.property.findUnique).mockResolvedValue(null);
    expect(await generateMetadata({ params: { mlsNumber: "x" } })).toEqual({ title: "Property Not Found" });
    vi.mocked(prisma.property.findUnique).mockRejectedValue(new Error("db down"));
    expect(await generateMetadata({ params: { mlsNumber: "x" } })).toEqual({ title: "Property" });
  });
});
