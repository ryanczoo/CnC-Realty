import { describe, it, expect, vi, beforeEach } from "vitest";

// unstable_cache needs Next's runtime; here it just calls through.
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: { count: vi.fn(), findMany: vi.fn() },
    agent: { findMany: vi.fn() },
    blogPost: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET as indexGET } from "../../app/sitemap.xml/route";
import { GET as childGET } from "../../app/sitemaps/[name]/route";

const child = (name: string) =>
  childGET(new Request(`http://localhost/sitemaps/${name}`), { params: { name } });

describe("GET /sitemap.xml", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists pages.xml plus one listings file per 40,000 active listings", async () => {
    vi.mocked(prisma.property.count).mockResolvedValue(85_000);
    const res = await indexGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    const xml = await res.text();
    expect(xml).toContain("https://cncrealtygroup.com/sitemaps/pages.xml");
    expect(xml).toContain("https://cncrealtygroup.com/sitemaps/listings-0.xml");
    expect(xml).toContain("https://cncrealtygroup.com/sitemaps/listings-1.xml");
    expect(xml).toContain("https://cncrealtygroup.com/sitemaps/listings-2.xml");
    expect(xml).not.toContain("listings-3.xml");
  });

  it("still returns 200 with pages.xml only when the database throws", async () => {
    vi.mocked(prisma.property.count).mockRejectedValue(new Error("db down"));
    const res = await indexGET();
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("sitemaps/pages.xml");
    expect(xml).not.toContain("listings-");
  });
});

describe("GET /sitemaps/pages.xml", () => {
  beforeEach(() => vi.clearAllMocks());

  it("has static paths, agents and press posts, but never /about or the test agent", async () => {
    vi.mocked(prisma.agent.findMany).mockResolvedValue([
      { slug: "ryan-chong", updatedAt: new Date("2026-10-01T00:00:00Z") },
      { slug: "claude-test-agent", updatedAt: new Date("2026-10-01T00:00:00Z") },
    ] as never);
    vi.mocked(prisma.blogPost.findMany).mockResolvedValue([
      { slug: "hello", updatedAt: new Date("2026-09-01T00:00:00Z") },
    ] as never);
    const res = await child("pages.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    const xml = await res.text();
    expect(xml).toContain("<loc>https://cncrealtygroup.com/buy</loc>");
    expect(xml).toContain("<loc>https://cncrealtygroup.com/agents/ryan-chong</loc>");
    expect(xml).toContain("<loc>https://cncrealtygroup.com/press/hello</loc>");
    expect(xml).not.toContain("/about");
    expect(xml).not.toContain("claude-test-agent");
  });

  it("returns 200 with just the static paths when the database throws", async () => {
    vi.mocked(prisma.agent.findMany).mockRejectedValue(new Error("db down"));
    vi.mocked(prisma.blogPost.findMany).mockRejectedValue(new Error("db down"));
    const res = await child("pages.xml");
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<loc>https://cncrealtygroup.com/buy</loc>");
    expect(xml).not.toContain("/agents/");
  });
});

describe("GET /sitemaps/listings-N.xml", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries the right slice of active listings", async () => {
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      { mlsNumber: "ML123", updatedAt: new Date("2026-10-02T00:00:00Z") },
    ] as never);
    const res = await child("listings-1.xml");
    expect(res.status).toBe(200);
    const args = vi.mocked(prisma.property.findMany).mock.calls[0]![0]!;
    expect(args).toMatchObject({
      where: { status: { in: ["Active", "ComingSoon", "ActiveUnderContract"] } },
      orderBy: { mlsNumber: "asc" },
      skip: 40000,
      take: 40000,
      select: { mlsNumber: true, updatedAt: true },
    });
    expect(await res.text()).toContain("<loc>https://cncrealtygroup.com/properties/ML123</loc>");
  });

  it("returns 404 for an unknown name", async () => {
    expect((await child("listings-x.xml")).status).toBe(404);
    expect((await child("nope.xml")).status).toBe(404);
  });
});
