import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { NewsGrid } from "@/components/blog/NewsGrid";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "News | CnC Realty Group",
  description: "Market updates, real estate tips, and news from CnC Realty Group.",
};

export default async function NewsPage() {
  let posts: Awaited<ReturnType<typeof fetchPosts>> = [];
  try {
    posts = await fetchPosts();
  } catch {
    // DB unreachable — show empty state
  }

  return (
    <div data-navbar-theme="light" className="min-h-screen bg-[#F2F0EF]">
      <div className="mx-auto max-w-7xl px-6 pt-32 pb-24 lg:px-8">
        <div className="mb-12">
          <h1 className="font-sans text-5xl font-light text-[#1B1B1B] lg:text-6xl">News</h1>
        </div>
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
