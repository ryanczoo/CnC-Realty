import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const FULL_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  content: true,
  coverImage: true,
  published: true,
  publishedAt: true,
  authorId: true,
  authorName: true,
  author: { select: { name: true } },
  createdAt: true,
  updatedAt: true,
} as const;

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  excerpt: z.string().optional(),
  content: z.string().optional(),
  coverImage: z.string().url().optional().or(z.literal("")),
  authorName: z.string().optional(),
  published: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const post = await prisma.blogPost.findUnique({
    where: { id: params.id },
    select: FULL_SELECT,
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(post);
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const post = await prisma.blogPost.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only author or ADMIN can edit
  if (post.authorId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = updateSchema.parse(body);

    // Only ADMIN can publish
    if (data.published !== undefined && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can publish posts" }, { status: 403 });
    }

    // Set publishedAt on first publish
    const publishedAt =
      data.published === true && !post.publishedAt ? new Date() : post.publishedAt;

    const updated = await prisma.blogPost.update({
      where: { id: params.id },
      data: {
        ...data,
        coverImage: data.coverImage === "" ? null : data.coverImage,
        publishedAt,
      },
      select: FULL_SELECT,
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("[PUT /api/blog/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("ADMIN");
  if (error) return error;
  void session;

  const post = await prisma.blogPost.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.blogPost.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
