import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const POST_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  published: true,
  publishedAt: true,
  authorName: true,
  author: { select: { name: true } },
  createdAt: true,
  updatedAt: true,
} as const;

const createSchema = z.object({
  title: z.string().min(1, "Title required"),
  slug: z.string().min(1, "Slug required"),
  excerpt: z.string().optional(),
  content: z.string().default(""),
  coverImage: z.string().url().optional().or(z.literal("")),
  authorName: z.string().optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") === "asc" ? "asc" : "desc";
  const all = searchParams.get("all") === "1";

  // "all=1" is admin-only — requires ADMIN auth
  if (all) {
    const { session, error } = await requireAuth("ADMIN");
    if (error) return error;
    void session;
    const posts = await prisma.blogPost.findMany({
      select: POST_SELECT,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(posts);
  }

  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    select: POST_SELECT,
    orderBy: { publishedAt: sort },
  });
  return NextResponse.json(posts);
}

export async function POST(req: Request) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    // Deduplicate slug
    const base = data.slug;
    let slug = base;
    let suffix = 2;
    while (await prisma.blogPost.findUnique({ where: { slug } })) {
      slug = `${base}-${suffix++}`;
    }

    const post = await prisma.blogPost.create({
      data: {
        ...data,
        slug,
        coverImage: data.coverImage || null,
        authorId: session.user.id,
        authorName: data.authorName || session.user.name || null,
      },
      select: POST_SELECT,
    });

    return NextResponse.json(post, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("[POST /api/blog]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
