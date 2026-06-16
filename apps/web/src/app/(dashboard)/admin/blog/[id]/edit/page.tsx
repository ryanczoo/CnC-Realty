import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BlogEditorForm } from "@/components/blog/admin/BlogEditorForm";

export const metadata = { title: "Edit Post | CnC Realty Admin" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditBlogPostPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as { id: string; name?: string | null; role: string };
  const isAdmin = user.role === "ADMIN";

  const post = await prisma.blogPost.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      coverImage: true,
      authorName: true,
      authorId: true,
      published: true,
    },
  });

  if (!post) notFound();

  // AGENT can only edit own posts
  if (!isAdmin && post.authorId !== user.id) redirect("/admin/blog");

  const defaultAuthorName = user.name ?? "CnC Realty";

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/blog" className="font-sans text-sm text-[#1B1B1B]/40 hover:text-[#1B1B1B] transition-colors">
          ← All Posts
        </Link>
        <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Edit Post</h1>
        {post.published && (
          <a
            href={`/press/${post.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-xs text-[#9E8C61] hover:underline"
          >
            View live ↗
          </a>
        )}
      </div>
      <BlogEditorForm
        post={post}
        isAdmin={isAdmin}
        defaultAuthorName={defaultAuthorName}
      />
    </div>
  );
}
