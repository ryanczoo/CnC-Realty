import type { Metadata } from "next";
import { cache } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PostBody } from "@/components/blog/PostBody";
import { OtherNews } from "@/components/blog/OtherNews";

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

const getPost = cache((slug: string) =>
  prisma.blogPost.findUnique({
    where: { slug, published: true },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      coverImage: true,
      publishedAt: true,
      authorName: true,
      author: { select: { name: true } },
    },
  })
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Not Found" };
  return {
    title: `${post.title} | CnC Realty Group`,
    description: post.excerpt ?? undefined,
    openGraph: post.coverImage
      ? { images: [{ url: post.coverImage }] }
      : undefined,
  };
}

export default async function PressPostPage({ params }: Props) {
  const { slug } = await params;

  const post = await getPost(slug);

  if (!post) notFound();

  const others = await prisma.blogPost.findMany({
    where: { published: true, id: { not: post.id } },
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
    take: 3,
  });

  const displayAuthor =
    post.authorName ??
    post.author?.name ??
    "CnC Realty Group";

  const publishedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div data-navbar-theme="light" className="min-h-screen bg-[#F2F0EF]">
      <div className="mx-auto max-w-7xl px-6 pt-24 pb-24 lg:px-8">

        {/* Cover image */}
        {post.coverImage && (
          <div className="relative w-full overflow-hidden rounded-2xl aspect-[21/9] mb-12">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              priority
              className="object-cover"
            />
          </div>
        )}

        {/* Two-column body */}
        <div className="flex flex-col gap-12 lg:flex-row lg:gap-16">

          {/* Left sticky panel */}
          <aside className="lg:w-[35%] lg:sticky lg:top-24 lg:self-start">
            <div className="flex flex-col gap-6">
              {publishedDate && (
                <p className="font-sans text-sm tracking-widest uppercase text-[#9E8C61]">
                  {publishedDate}
                </p>
              )}
              <h1 className="font-sans text-[2.5rem] font-light text-[#1B1B1B] leading-snug">
                {post.title}
              </h1>
              <p className="font-sans text-sm text-[#1B1B1B]/50">{displayAuthor}</p>
              <Link
                href="/press"
                className="inline-flex items-center gap-2 font-sans text-sm text-[#1B1B1B]/50 hover:text-[#9E8C61] transition-colors mt-4"
              >
                ← Back to Press
              </Link>
            </div>
          </aside>

          {/* Right content panel */}
          <main className="lg:w-[65%]">
            <PostBody html={post.content} />
          </main>
        </div>

        {/* Other news */}
        {others.length > 0 && (
          <div className="mt-24">
            <OtherNews posts={others} />
          </div>
        )}
      </div>
    </div>
  );
}
