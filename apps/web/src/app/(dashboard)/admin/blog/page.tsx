import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/server-utils";
import { BlogPostList } from "@/components/blog/admin/BlogPostList";

export const metadata = { title: "Blog Posts | CnC Realty Admin" };

export default async function AdminBlogPage() {
  await requireAdminPage();

  const posts = await prisma.blogPost.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      published: true,
      publishedAt: true,
      createdAt: true,
      coverImage: true,
      authorName: true,
      author: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  }).catch(() => []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Blog Posts</h1>
          <p className="mt-1 text-sm text-[#1B1B1B]/40">{posts.length} total</p>
        </div>
        <Link
          href="/admin/blog/new"
          className="rounded-full bg-[#1B1B1B] px-5 py-2.5 font-sans text-sm font-medium text-white transition-opacity hover:opacity-75"
        >
          + New Post
        </Link>
      </div>
      <BlogPostList posts={posts} />
    </div>
  );
}
