import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { NewsGrid } from "@/components/blog/NewsGrid";
import { PressHero } from "@/components/blog/PressHero";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Press | CnC Realty Group",
  description: "Market updates, real estate tips, and news from CnC Realty Group.",
};

export default async function PressPage() {
  let posts: Awaited<ReturnType<typeof fetchPosts>> = [];
  try {
    posts = await fetchPosts();
  } catch {
    // DB unreachable — show empty state
  }

  return (
    <div className="min-h-screen bg-[#F2F0EF]">
      <PressHero />
      <div data-navbar-theme="light" className="mx-auto max-w-7xl px-6 pt-24 pb-24 lg:px-8">
        <NewsGrid posts={posts} />
      </div>
    </div>
  );
}

async function fetchPosts() {
  return prisma.blogPost.findMany({
    where: { published: true },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImage: true,
      publishedAt: true,
      authorName: true,
      author: { select: { name: true } },
    },
    orderBy: { publishedAt: "desc" },
  });
}
