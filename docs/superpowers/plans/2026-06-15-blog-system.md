# Blog / News System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full database-driven blog system with a public `/news` page, individual post pages, and an admin editor with Tiptap, role-based publishing, and auto-save.

**Architecture:** Server Components with ISR (`revalidate: 300`) fetch published posts from PostgreSQL and pass them to lightweight Client Components for interactivity (sort toggle, editor). Admin pages live inside the existing `(dashboard)/admin/` route group. API routes follow the existing `requireAuth` + Zod pattern.

**Tech Stack:** Next.js 14 App Router, Prisma, Tiptap v3 (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`), `@tailwindcss/typography` (new), Framer Motion, Zod, NextAuth

---

## File Map

**Create:**
- `apps/web/src/app/api/blog/route.ts` — GET list + POST create
- `apps/web/src/app/api/blog/[id]/route.ts` — GET + PUT + DELETE single post
- `apps/web/src/components/blog/BlogCard.tsx` — reusable post card (grid + OtherNews)
- `apps/web/src/components/blog/BlogHero.tsx` — featured hero post (most recent)
- `apps/web/src/components/blog/SortFilter.tsx` — sort pill (Newest/Oldest)
- `apps/web/src/components/blog/NewsGrid.tsx` — client wrapper: manages sort state, renders hero + grid
- `apps/web/src/components/blog/PostBody.tsx` — renders Tiptap HTML with prose styles
- `apps/web/src/components/blog/OtherNews.tsx` — 3 recent posts at bottom of post page
- `apps/web/src/components/blog/admin/BlogEditorForm.tsx` — Tiptap editor + all fields (client)
- `apps/web/src/components/blog/admin/BlogPostList.tsx` — admin table of all posts (client)
- `apps/web/src/app/news/page.tsx` — public index (Server Component, ISR)
- `apps/web/src/app/news/[slug]/page.tsx` — public post detail (Server Component, ISR)
- `apps/web/src/app/(dashboard)/admin/blog/page.tsx` — admin post list page
- `apps/web/src/app/(dashboard)/admin/blog/new/page.tsx` — create post page
- `apps/web/src/app/(dashboard)/admin/blog/[id]/edit/page.tsx` — edit post page

**Modify:**
- `packages/database/prisma/schema.prisma` — add `authorId`, `authorName`, `author` to BlogPost; add `blogPosts` to User
- `apps/web/tailwind.config.ts` — add `@tailwindcss/typography` plugin
- `apps/web/src/app/(dashboard)/admin/page.tsx` — add "Manage Blog" button

---

## Task 1: Install Dependencies

**Files:**
- Modify: `apps/web/package.json` (via pnpm)
- Modify: `apps/web/tailwind.config.ts`

- [ ] **Step 1: Install packages**

Run from `C:\Users\hey_r\Desktop\CnC-Realty`:
```powershell
pnpm --filter web add @tailwindcss/typography @tiptap/extension-link
```
Expected: both packages appear in `apps/web/package.json` dependencies.

- [ ] **Step 2: Add typography plugin to tailwind.config.ts**

In `apps/web/tailwind.config.ts`, add the import at the top and plugin in the plugins array:

```ts
import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ... existing theme config unchanged ...
    },
  },
  plugins: [typography],
};

export default config;
```

Only add the `import typography` line at the top and `typography` to the plugins array. Do not change any existing theme config.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/tailwind.config.ts
git commit -m "feat(blog): install typography plugin and tiptap link extension"
```

---

## Task 2: Schema Migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Update BlogPost model**

In `packages/database/prisma/schema.prisma`, replace the existing `BlogPost` model with:

```prisma
model BlogPost {
  id          String    @id @default(cuid())
  title       String
  slug        String    @unique
  excerpt     String?
  content     String
  published   Boolean   @default(false)
  publishedAt DateTime?
  coverImage  String?
  authorId    String?
  authorName  String?
  author      User?     @relation(fields: [authorId], references: [id], onDelete: SetNull)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

- [ ] **Step 2: Add back-relation on User model**

In the `User` model (around line 586), add `blogPosts` to the relations list:

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?
  role          UserRole  @default(BUYER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts           Account[]
  sessions           Session[]
  agent              Agent?
  savedSearches      SavedSearch[]
  savedProperties    SavedProperty[]
  uploadedDocuments  FileDocument[]  @relation("DocumentUploader")
  reviewedDocuments  FileDocument[]  @relation("DocumentReviewer")
  fileActivities     FileActivity[]  @relation("FileActivityActor")
  blogPosts          BlogPost[]
}
```

- [ ] **Step 3: Run migration (PowerShell — not bash)**

```powershell
cd C:\Users\hey_r\Desktop\CnC-Realty
pnpm --filter @cnc/database exec prisma migrate dev --name add_blog_author
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 4: Regenerate Prisma client**

```powershell
pnpm --filter @cnc/database exec prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(blog): add authorId and authorName to BlogPost schema"
```

---

## Task 3: API Routes — List + Create (`/api/blog`)

**Files:**
- Create: `apps/web/src/app/api/blog/route.ts`

- [ ] **Step 1: Create the route file**

Create `apps/web/src/app/api/blog/route.ts`:

```ts
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
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error("[POST /api/blog]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
pnpm --filter web build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 20
```

Expected: no TypeScript errors related to `blog/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/blog/route.ts
git commit -m "feat(blog): add GET list and POST create API routes"
```

---

## Task 4: API Routes — Single Post CRUD (`/api/blog/[id]`)

**Files:**
- Create: `apps/web/src/app/api/blog/[id]/route.ts`

- [ ] **Step 1: Create the route file**

Create `apps/web/src/app/api/blog/[id]/route.ts`:

```ts
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
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
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
```

- [ ] **Step 2: Verify TypeScript**

```powershell
pnpm --filter web build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/blog/[id]/route.ts
git commit -m "feat(blog): add GET/PUT/DELETE single post API routes"
```

---

## Task 5: BlogCard Component

**Files:**
- Create: `apps/web/src/components/blog/BlogCard.tsx`

- [ ] **Step 1: Create BlogCard**

Create `apps/web/src/components/blog/BlogCard.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";

export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: string | Date | null;
  authorName: string | null;
  author: { name: string | null } | null;
}

function formatDate(d: string | Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function BlogCard({ post }: { post: BlogPostSummary }) {
  return (
    <Link href={`/news/${post.slug}`} className="group flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl aspect-[16/9] bg-[#1B1B1B] relative">
        {post.coverImage ? (
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-[#1B1B1B]" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-sans text-sm text-[#9E8C61]">{formatDate(post.publishedAt)}</p>
        <h3 className="font-sans text-lg font-light text-[#1B1B1B] leading-snug line-clamp-2 group-hover:text-[#9E8C61] transition-colors">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="font-sans text-sm text-[#1B1B1B]/60 line-clamp-2 leading-relaxed">
            {post.excerpt}
          </p>
        )}
        <span className="mt-1 inline-flex items-center gap-1 font-sans text-sm text-[#1B1B1B]/50 group-hover:text-[#9E8C61] transition-colors">
          Read More →
        </span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/blog/BlogCard.tsx
git commit -m "feat(blog): add BlogCard component"
```

---

## Task 6: BlogHero + SortFilter + NewsGrid

**Files:**
- Create: `apps/web/src/components/blog/BlogHero.tsx`
- Create: `apps/web/src/components/blog/SortFilter.tsx`
- Create: `apps/web/src/components/blog/NewsGrid.tsx`

- [ ] **Step 1: Create BlogHero**

Create `apps/web/src/components/blog/BlogHero.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { SPRING_HOVER, PULSE_ANIMATE, PULSE_TRANSITION } from "@/lib/motion";
import type { BlogPostSummary } from "./BlogCard";

function formatDate(d: string | Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function BlogHero({ post }: { post: BlogPostSummary }) {
  return (
    <Link href={`/news/${post.slug}`} className="group flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
      {/* Cover image */}
      <div className="relative w-full overflow-hidden rounded-2xl aspect-[16/9] bg-[#1B1B1B] lg:w-[58%] flex-shrink-0">
        {post.coverImage ? (
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            priority
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-[#1B1B1B]" />
        )}
      </div>

      {/* Text panel */}
      <div className="flex flex-col gap-5 flex-1">
        <p className="font-sans text-sm tracking-widest uppercase text-[#9E8C61]">
          {formatDate(post.publishedAt)}
        </p>
        <h2 className="font-sans text-[2rem] font-light text-[#1B1B1B] leading-snug group-hover:text-[#9E8C61] transition-colors">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="font-sans text-base text-[#1B1B1B]/60 leading-relaxed">
            {post.excerpt}
          </p>
        )}
        <motion.div
          whileHover={{ scale: 1.05 }}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          className="self-start"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-[#1B1B1B] px-6 py-3 font-sans text-sm font-medium text-white">
            Read More →
          </span>
        </motion.div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create SortFilter**

Create `apps/web/src/components/blog/SortFilter.tsx`:

```tsx
"use client";

import { motion } from "motion/react";
import { SPRING_HOVER } from "@/lib/motion";

interface SortFilterProps {
  sort: "desc" | "asc";
  onToggle: () => void;
}

export function SortFilter({ sort, onToggle }: SortFilterProps) {
  return (
    <motion.button
      onClick={onToggle}
      whileHover={{ scale: 1.05 }}
      transition={SPRING_HOVER}
      className="flex items-center gap-2 rounded-full border border-[#1B1B1B]/20 px-4 py-2 font-sans text-sm text-[#1B1B1B]/70 transition-colors hover:border-[#1B1B1B]/40 hover:text-[#1B1B1B]"
    >
      <span>{sort === "desc" ? "Newest First" : "Oldest First"}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    </motion.button>
  );
}
```

- [ ] **Step 3: Create NewsGrid (client wrapper)**

Create `apps/web/src/components/blog/NewsGrid.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { BlogHero } from "./BlogHero";
import { BlogCard, type BlogPostSummary } from "./BlogCard";
import { SortFilter } from "./SortFilter";

export function NewsGrid({ posts }: { posts: BlogPostSummary[] }) {
  const [sort, setSort] = useState<"desc" | "asc">("desc");

  const sorted = useMemo(
    () =>
      [...posts].sort((a, b) => {
        const da = new Date(a.publishedAt ?? a.id).getTime();
        const db = new Date(b.publishedAt ?? b.id).getTime();
        return sort === "desc" ? db - da : da - db;
      }),
    [posts, sort]
  );

  const [hero, ...rest] = sorted;

  if (!hero) {
    return (
      <p className="font-sans text-base text-[#1B1B1B]/40">No posts yet. Check back soon.</p>
    );
  }

  return (
    <div className="flex flex-col gap-16">
      {/* Sort + hero */}
      <div className="flex flex-col gap-8">
        <div className="flex justify-end">
          <SortFilter sort={sort} onToggle={() => setSort((s) => (s === "desc" ? "asc" : "desc"))} />
        </div>
        <BlogHero post={hero} />
      </div>

      {/* Grid */}
      {rest.length > 0 && (
        <div className="border-t border-[#1B1B1B]/10 pt-12">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/blog/BlogHero.tsx apps/web/src/components/blog/SortFilter.tsx apps/web/src/components/blog/NewsGrid.tsx
git commit -m "feat(blog): add BlogHero, SortFilter, and NewsGrid components"
```

---

## Task 7: Public `/news` Index Page

**Files:**
- Create: `apps/web/src/app/news/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/src/app/news/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify in browser**

Start dev server (`pnpm --filter web dev`) and open `http://localhost:3000/news`. Expected: page loads with off-white background, dark navbar logo/pills, "News" heading, and "No posts yet" empty state (since DB has no posts yet).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/news/page.tsx
git commit -m "feat(blog): add public /news index page with ISR"
```

---

## Task 8: PostBody + OtherNews Components

**Files:**
- Create: `apps/web/src/components/blog/PostBody.tsx`
- Create: `apps/web/src/components/blog/OtherNews.tsx`

- [ ] **Step 1: Create PostBody**

Create `apps/web/src/components/blog/PostBody.tsx`:

```tsx
interface PostBodyProps {
  html: string;
}

export function PostBody({ html }: PostBodyProps) {
  return (
    <div
      className="prose prose-neutral max-w-none prose-headings:font-sans prose-headings:font-light prose-headings:text-[#1B1B1B] prose-p:text-[#1B1B1B]/80 prose-p:leading-relaxed prose-a:text-[#9E8C61] prose-a:no-underline hover:prose-a:underline prose-strong:text-[#1B1B1B] prose-li:text-[#1B1B1B]/80 prose-img:rounded-2xl"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

- [ ] **Step 2: Create OtherNews**

Create `apps/web/src/components/blog/OtherNews.tsx`:

```tsx
import { BlogCard, type BlogPostSummary } from "./BlogCard";

interface OtherNewsProps {
  posts: BlogPostSummary[];
}

export function OtherNews({ posts }: OtherNewsProps) {
  if (posts.length === 0) return null;

  return (
    <section className="border-t border-[#1B1B1B]/10 pt-16">
      <h2 className="mb-10 font-sans text-3xl font-light text-[#1B1B1B]">Other News</h2>
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <BlogCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/blog/PostBody.tsx apps/web/src/components/blog/OtherNews.tsx
git commit -m "feat(blog): add PostBody and OtherNews components"
```

---

## Task 9: Public `/news/[slug]` Post Page

**Files:**
- Create: `apps/web/src/app/news/[slug]/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/src/app/news/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PostBody } from "@/components/blog/PostBody";
import { OtherNews } from "@/components/blog/OtherNews";

export const revalidate = 300;

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return { title: "Not Found" };
  return {
    title: `${post.title} | CnC Realty News`,
    description: post.excerpt ?? undefined,
    openGraph: post.coverImage ? { images: [post.coverImage] } : undefined,
  };
}

export default async function PostPage({ params }: Props) {
  const post = await getPost(params.slug);
  if (!post) notFound();

  const otherPosts = await prisma.blogPost.findMany({
    where: { published: true, NOT: { slug: params.slug } },
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

  const authorLabel = post.authorName ?? post.author?.name ?? "CnC Realty";
  const dateLabel = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div data-navbar-theme="light" className="min-h-screen bg-[#F2F0EF]">
      <div className="mx-auto max-w-7xl px-6 pt-28 pb-24 lg:px-8">

        {/* Cover image */}
        {post.coverImage && (
          <div className="relative mb-12 w-full overflow-hidden rounded-2xl aspect-[16/9]">
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
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">

          {/* Left panel — sticky */}
          <div className="lg:w-[35%] lg:flex-shrink-0">
            <div className="lg:sticky lg:top-24 flex flex-col gap-5">
              <p className="font-sans text-sm tracking-widest uppercase text-[#9E8C61]">
                {dateLabel}
              </p>
              <h1 className="font-sans text-[2.5rem] font-light text-[#1B1B1B] leading-snug">
                {post.title}
              </h1>
              <p className="font-sans text-sm text-[#1B1B1B]/50">By {authorLabel}</p>
              <Link
                href="/news"
                className="mt-4 inline-flex items-center gap-1 font-sans text-sm text-[#1B1B1B]/40 transition-colors hover:text-[#1B1B1B]"
              >
                ← Back to News
              </Link>
            </div>
          </div>

          {/* Right panel — body content */}
          <div className="flex-1 min-w-0">
            <PostBody html={post.content} />
          </div>
        </div>

        {/* Other News */}
        <div className="mt-24">
          <OtherNews posts={otherPosts} />
        </div>

      </div>
    </div>
  );
}

async function getPost(slug: string) {
  return prisma.blogPost.findFirst({
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
  });
}
```

- [ ] **Step 2: Verify build**

```powershell
pnpm --filter web build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/news/[slug]/page.tsx
git commit -m "feat(blog): add public /news/[slug] post detail page"
```

---

## Task 10: Admin BlogEditorForm

**Files:**
- Create: `apps/web/src/components/blog/admin/BlogEditorForm.tsx`

- [ ] **Step 1: Create the editor form**

Create `apps/web/src/components/blog/admin/BlogEditorForm.tsx`:

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Bold, Italic, List, ListOrdered, Heading2, Heading3, Link2 } from "lucide-react";
import Image from "next/image";

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  authorName: string | null;
  published: boolean;
}

interface BlogEditorFormProps {
  post?: Post;
  isAdmin: boolean;
  defaultAuthorName: string;
}

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function BlogEditorForm({ post, isAdmin, defaultAuthorName }: BlogEditorFormProps) {
  const router = useRouter();
  const isNew = !post;

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugManual, setSlugManual] = useState(!isNew);
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [coverImage, setCoverImage] = useState(post?.coverImage ?? "");
  const [authorName, setAuthorName] = useState(post?.authorName ?? defaultAuthorName);
  const [published, setPublished] = useState(post?.published ?? false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const postIdRef = useRef<string | null>(post?.id ?? null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write your post content here..." }),
      Link.configure({ openOnClick: false }),
    ],
    content: post?.content ?? "",
    editorProps: {
      attributes: {
        class: "min-h-[400px] p-4 outline-none font-sans text-sm text-[#1B1B1B] leading-relaxed prose prose-neutral max-w-none",
      },
    },
  });

  // Auto-generate slug from title (until manually edited)
  useEffect(() => {
    if (!slugManual && title) setSlug(toSlug(title));
  }, [title, slugManual]);

  const getPayload = useCallback(() => ({
    title,
    slug,
    excerpt,
    content: editor?.getHTML() ?? "",
    coverImage,
    authorName,
  }), [title, slug, excerpt, editor, coverImage, authorName]);

  const saveDraft = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (isNew && !postIdRef.current) {
        // First save — create the post
        const res = await fetch("/api/blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(getPayload()),
        });
        if (!res.ok) throw new Error(await res.text());
        const created = await res.json();
        postIdRef.current = created.id;
        // Update URL without reload so auto-save has an ID from now on
        window.history.replaceState({}, "", `/admin/blog/${created.id}/edit`);
      } else if (postIdRef.current) {
        const res = await fetch(`/api/blog/${postIdRef.current}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(getPayload()),
        });
        if (!res.ok) throw new Error(await res.text());
      }
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch (err) {
      console.error(err);
      setSaveMsg("Save failed");
    } finally {
      setSaving(false);
    }
  }, [isNew, getPayload]);

  // Schedule auto-save 30s after any change (only if post already has an ID)
  useEffect(() => {
    if (isNew && !postIdRef.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(saveDraft, 30_000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [title, slug, excerpt, coverImage, authorName, isNew, saveDraft]);

  const handlePublish = async () => {
    await saveDraft();
    if (!postIdRef.current) return;
    setSaving(true);
    try {
      await fetch(`/api/blog/${postIdRef.current}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: true }),
      });
      setPublished(true);
      setSaveMsg("Published!");
      setTimeout(() => setSaveMsg(""), 2000);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublish = async () => {
    if (!postIdRef.current) return;
    setSaving(true);
    try {
      await fetch(`/api/blog/${postIdRef.current}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: false }),
      });
      setPublished(false);
      setSaveMsg("Unpublished");
      setTimeout(() => setSaveMsg(""), 2000);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const toolBtn = (active: boolean) =>
    `rounded px-2 py-1 text-xs transition-colors ${
      active ? "bg-[#1B1B1B] text-white" : "text-[#1B1B1B]/50 hover:text-[#1B1B1B]"
    }`;

  return (
    <div className="flex flex-col gap-8">

      {/* Title */}
      <div>
        <label className="mb-1.5 block font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Post title"
          className="w-full rounded-xl border border-[#1B1B1B]/10 bg-white px-4 py-3 font-sans text-lg text-[#1B1B1B] outline-none placeholder:text-[#1B1B1B]/30 focus:border-[#1B1B1B]/30"
        />
      </div>

      {/* Slug */}
      <div>
        <label className="mb-1.5 block font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Slug</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
          placeholder="post-url-slug"
          className="w-full rounded-xl border border-[#1B1B1B]/10 bg-white px-4 py-3 font-sans text-sm text-[#1B1B1B] outline-none placeholder:text-[#1B1B1B]/30 focus:border-[#1B1B1B]/30"
        />
        <p className="mt-1 font-sans text-xs text-[#1B1B1B]/40">cncrealtygroup.com/news/{slug || "..."}</p>
      </div>

      {/* Excerpt */}
      <div>
        <label className="mb-1.5 block font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Excerpt</label>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={2}
          placeholder="Short summary shown on the news index page and in search results"
          className="w-full resize-none rounded-xl border border-[#1B1B1B]/10 bg-white px-4 py-3 font-sans text-sm text-[#1B1B1B] outline-none placeholder:text-[#1B1B1B]/30 focus:border-[#1B1B1B]/30"
        />
      </div>

      {/* Cover Image URL */}
      <div>
        <label className="mb-1.5 block font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Cover Image URL</label>
        <input
          type="url"
          value={coverImage}
          onChange={(e) => setCoverImage(e.target.value)}
          placeholder="https://images.pexels.com/..."
          className="w-full rounded-xl border border-[#1B1B1B]/10 bg-white px-4 py-3 font-sans text-sm text-[#1B1B1B] outline-none placeholder:text-[#1B1B1B]/30 focus:border-[#1B1B1B]/30"
        />
        {coverImage && (
          <div className="mt-3 relative h-40 w-full overflow-hidden rounded-xl">
            <Image src={coverImage} alt="Cover preview" fill className="object-cover" unoptimized />
          </div>
        )}
      </div>

      {/* Author Name */}
      <div>
        <label className="mb-1.5 block font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Author Name</label>
        <input
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="e.g. Ryan Chong or CnC Realty AI"
          className="w-full rounded-xl border border-[#1B1B1B]/10 bg-white px-4 py-3 font-sans text-sm text-[#1B1B1B] outline-none placeholder:text-[#1B1B1B]/30 focus:border-[#1B1B1B]/30"
        />
      </div>

      {/* Body — Tiptap */}
      <div>
        <label className="mb-1.5 block font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Body</label>
        <div className="overflow-hidden rounded-xl border border-[#1B1B1B]/10 bg-white">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-1 border-b border-[#1B1B1B]/10 px-3 py-2">
            <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={toolBtn(editor?.isActive("heading", { level: 2 }) ?? false)}><Heading2 className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} className={toolBtn(editor?.isActive("heading", { level: 3 }) ?? false)}><Heading3 className="h-3.5 w-3.5" /></button>
            <div className="mx-1 h-4 w-px bg-[#1B1B1B]/10" />
            <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} className={toolBtn(editor?.isActive("bold") ?? false)}><Bold className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} className={toolBtn(editor?.isActive("italic") ?? false)}><Italic className="h-3.5 w-3.5" /></button>
            <div className="mx-1 h-4 w-px bg-[#1B1B1B]/10" />
            <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()} className={toolBtn(editor?.isActive("bulletList") ?? false)}><List className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={toolBtn(editor?.isActive("orderedList") ?? false)}><ListOrdered className="h-3.5 w-3.5" /></button>
            <div className="mx-1 h-4 w-px bg-[#1B1B1B]/10" />
            <button
              type="button"
              onClick={() => {
                const url = window.prompt("URL:");
                if (url) editor?.chain().focus().setLink({ href: url }).run();
              }}
              className={toolBtn(editor?.isActive("link") ?? false)}
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 border-t border-[#1B1B1B]/10 pt-6">
        <button
          type="button"
          onClick={saveDraft}
          disabled={saving}
          className="rounded-full bg-[#F2F0EF] px-6 py-2.5 font-sans text-sm font-medium text-[#1B1B1B] transition-opacity hover:opacity-70 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save Draft"}
        </button>

        {isAdmin && !published && (
          <button
            type="button"
            onClick={handlePublish}
            disabled={saving}
            className="rounded-full bg-[#1B1B1B] px-6 py-2.5 font-sans text-sm font-medium text-white transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            Publish
          </button>
        )}

        {isAdmin && published && (
          <button
            type="button"
            onClick={handleUnpublish}
            disabled={saving}
            className="rounded-full border border-[#1B1B1B]/20 px-6 py-2.5 font-sans text-sm font-medium text-[#1B1B1B]/60 transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            Unpublish
          </button>
        )}

        {!isAdmin && (
          <span className="rounded-full border border-[#1B1B1B]/10 px-4 py-2 font-sans text-xs text-[#1B1B1B]/40">
            Pending Review — Admin publishes
          </span>
        )}

        {saveMsg && (
          <span className="font-sans text-sm text-[#9E8C61]">{saveMsg}</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/blog/admin/BlogEditorForm.tsx
git commit -m "feat(blog): add BlogEditorForm with Tiptap, auto-save, and publish toggle"
```

---

## Task 11: Admin Post List + Page

**Files:**
- Create: `apps/web/src/components/blog/admin/BlogPostList.tsx`
- Create: `apps/web/src/app/(dashboard)/admin/blog/page.tsx`

- [ ] **Step 1: Create BlogPostList**

Create `apps/web/src/components/blog/admin/BlogPostList.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface PostRow {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  coverImage: string | null;
  authorName: string | null;
  author: { name: string | null } | null;
}

export function BlogPostList({ posts: initial }: { posts: PostRow[] }) {
  const [posts, setPosts] = useState(initial);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await fetch(`/api/blog/${id}`, { method: "DELETE" });
      setPosts((p) => p.filter((x) => x.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#1B1B1B]/10">
      <table className="w-full text-sm">
        <thead className="bg-[#F2F0EF] text-left text-xs uppercase tracking-wider text-[#1B1B1B]/50">
          <tr>
            <th className="px-4 py-3 w-12" />
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Author</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1B1B1B]/5 bg-white">
          {posts.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-[#1B1B1B]/40">
                No posts yet.{" "}
                <Link href="/admin/blog/new" className="text-[#9E8C61] hover:underline">
                  Create your first post →
                </Link>
              </td>
            </tr>
          )}
          {posts.map((post) => (
            <tr key={post.id} className="hover:bg-[#F2F0EF]/40">
              <td className="px-4 py-3">
                {post.coverImage && (
                  <div className="relative h-10 w-14 overflow-hidden rounded-lg">
                    <Image src={post.coverImage} alt="" fill className="object-cover" unoptimized />
                  </div>
                )}
              </td>
              <td className="px-4 py-3 font-medium text-[#1B1B1B] max-w-xs truncate">{post.title}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  post.published
                    ? "bg-green-100 text-green-700"
                    : "bg-[#F2F0EF] text-[#1B1B1B]/50"
                }`}>
                  {post.published ? "Published" : "Draft"}
                </span>
              </td>
              <td className="px-4 py-3 text-[#1B1B1B]/60">{post.authorName ?? post.author?.name ?? "—"}</td>
              <td className="px-4 py-3 text-[#1B1B1B]/60">
                {post.publishedAt
                  ? new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-3">
                  <Link
                    href={`/admin/blog/${post.id}/edit`}
                    className="font-sans text-xs text-[#1B1B1B]/50 hover:text-[#1B1B1B] transition-colors"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(post.id)}
                    disabled={deleting === post.id}
                    className="font-sans text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                  >
                    {deleting === post.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create admin blog list page**

Create `apps/web/src/app/(dashboard)/admin/blog/page.tsx`:

```tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/blog/admin/BlogPostList.tsx apps/web/src/app/(dashboard)/admin/blog/page.tsx
git commit -m "feat(blog): add admin blog list page and BlogPostList component"
```

---

## Task 12: Admin Create + Edit Pages

**Files:**
- Create: `apps/web/src/app/(dashboard)/admin/blog/new/page.tsx`
- Create: `apps/web/src/app/(dashboard)/admin/blog/[id]/edit/page.tsx`

- [ ] **Step 1: Create new post page**

Create `apps/web/src/app/(dashboard)/admin/blog/new/page.tsx`:

```tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BlogEditorForm } from "@/components/blog/admin/BlogEditorForm";

export const metadata = { title: "New Post | CnC Realty Admin" };

export default async function NewBlogPostPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as { name?: string | null; role: string };
  const isAdmin = user.role === "ADMIN";
  const defaultAuthorName = user.name ?? "CnC Realty";

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/blog" className="font-sans text-sm text-[#1B1B1B]/40 hover:text-[#1B1B1B] transition-colors">
          ← All Posts
        </Link>
        <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">New Post</h1>
      </div>
      <BlogEditorForm isAdmin={isAdmin} defaultAuthorName={defaultAuthorName} />
    </div>
  );
}
```

- [ ] **Step 2: Create edit post page**

Create `apps/web/src/app/(dashboard)/admin/blog/[id]/edit/page.tsx`:

```tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BlogEditorForm } from "@/components/blog/admin/BlogEditorForm";

export const metadata = { title: "Edit Post | CnC Realty Admin" };

interface Props {
  params: { id: string };
}

export default async function EditBlogPostPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as { id: string; name?: string | null; role: string };
  const isAdmin = user.role === "ADMIN";

  const post = await prisma.blogPost.findUnique({
    where: { id: params.id },
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
            href={`/news/${post.slug}`}
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
```

- [ ] **Step 3: Verify TypeScript**

```powershell
pnpm --filter web build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/admin/blog/new/page.tsx apps/web/src/app/(dashboard)/admin/blog/[id]/edit/page.tsx
git commit -m "feat(blog): add admin create and edit post pages"
```

---

## Task 13: Admin Overview Link + Final Verification

**Files:**
- Modify: `apps/web/src/app/(dashboard)/admin/page.tsx`

- [ ] **Step 1: Add Blog button to admin overview**

In `apps/web/src/app/(dashboard)/admin/page.tsx`, add a "Manage Blog" link to the existing quick-links section:

```tsx
// Find the existing <div className="flex flex-wrap gap-3"> block and add:
<Link
  href="/admin/blog"
  className="rounded-full bg-[#1B1B1B] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-75"
>
  Manage Blog →
</Link>
```

Add it after the existing "View All Files →" link.

- [ ] **Step 2: End-to-end verification**

With the dev server running:

1. Open `http://localhost:3000/news` — verify: off-white page, dark navbar, "News" heading, empty state message
2. Open `http://localhost:3000/admin/blog` — verify: admin blog list loads, "No posts yet" message, "+ New Post" button
3. Click "+ New Post" — verify: editor loads with all fields, Tiptap toolbar visible
4. Fill in: Title = "Welcome to CnC Realty News", Excerpt = "Our first post.", cover image URL from Pexels, body text. Click "Save Draft". Verify: URL updates to `/admin/blog/[id]/edit`, "Saved" message appears.
5. Click "Publish". Verify: post status badge turns green "Published".
6. Open `http://localhost:3000/news` — verify: post appears as the hero.
7. Click the hero post — verify: post detail page loads with two-column layout, cover image, body, "Other News" section hidden (no other posts).
8. Back in admin, create a second and third post, publish both.
9. Revisit `/news` — verify: hero = most recent, 3-column grid shows others.
10. Revisit any post page — verify "Other News" shows the other 2–3 posts.
11. Toggle sort filter on `/news` — verify order reverses.

- [ ] **Step 3: Final commit**

```bash
git add apps/web/src/app/(dashboard)/admin/page.tsx
git commit -m "feat(blog): add Manage Blog link to admin overview — blog system complete"
```
