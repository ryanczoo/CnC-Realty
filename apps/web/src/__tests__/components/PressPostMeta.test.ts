import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: (fn: unknown) => fn,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { blogPost: { findUnique: vi.fn(), findMany: vi.fn() } },
}));
vi.mock("@/components/blog/PostBody", () => ({ PostBody: () => null }));
vi.mock("@/components/blog/OtherNews", () => ({ OtherNews: () => null }));

import { prisma } from "@/lib/prisma";
import { generateMetadata } from "../../app/press/[slug]/page";

const POST = {
  id: "p1",
  title: "Why Rates Matter",
  slug: "why-rates-matter",
  excerpt: "A quick look at mortgage rates.",
  coverImage: "https://cdn.example.com/cover.jpg",
} as any;

const props = { params: Promise.resolve({ slug: "why-rates-matter" }) };

describe("press post generateMetadata", () => {
  beforeEach(() => vi.clearAllMocks());

  it("titles the page with just the post title (the root template adds the brand) and canonicalises it", async () => {
    vi.mocked(prisma.blogPost.findUnique).mockResolvedValue(POST);
    const meta = await generateMetadata(props);
    expect(meta.title).toBe("Why Rates Matter");
    expect(meta.alternates?.canonical).toBe("/press/why-rates-matter");
    expect(meta.description).toBe("A quick look at mortgage rates.");
  });

  it("shares the cover image, falling back to the default preview image", async () => {
    vi.mocked(prisma.blogPost.findUnique).mockResolvedValue(POST);
    expect((await generateMetadata(props)).openGraph?.images).toEqual([
      { url: "https://cdn.example.com/cover.jpg" },
    ]);
    vi.mocked(prisma.blogPost.findUnique).mockResolvedValue({ ...POST, coverImage: null });
    expect((await generateMetadata(props)).openGraph?.images).toEqual([
      expect.objectContaining({ url: "/og-default.jpg" }),
    ]);
  });
});
