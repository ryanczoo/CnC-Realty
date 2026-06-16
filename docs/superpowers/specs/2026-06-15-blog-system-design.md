# Blog / News System Design

**Date:** 2026-06-15
**Status:** Approved by Ryan — ready for implementation planning

---

## Overview

Build a full database-driven blog system for the `/news` section of cncrealtygroup.com. Posts are authored through an admin editor, rendered publicly on a FIND-inspired layout, and managed by Ryan (ADMIN) or designated agents/assistants (AGENT role creates drafts only).

---

## Architecture

### Public Pages
- `/news` — index page (ISR `revalidate: 300`)
- `/news/[slug]` — individual post page (ISR `revalidate: 300`)

### Admin Pages (inside existing `/admin` dashboard)
- `/admin/blog` — post list with status, edit/delete actions
- `/admin/blog/new` — create post
- `/admin/blog/[id]/edit` — edit existing post

### API Routes
| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/blog` | GET | Public | Published posts only, sorted by `publishedAt` desc. Supports `?sort=asc` for oldest-first. |
| `/api/blog` | POST | AGENT+ | Create new draft post |
| `/api/blog/[id]` | GET | Public | Single published post by slug. ADMIN/AGENT can fetch own drafts. |
| `/api/blog/[id]` | PUT | AGENT+ | Update post. Only ADMIN can set `published: true`. |
| `/api/blog/[id]` | DELETE | ADMIN | Permanently delete post |

---

## Database Schema Changes

Add author relation and AI-author fallback to the existing `BlogPost` model in `packages/database/prisma/schema.prisma`:

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

Add back-relation on `User` model:
```prisma
blogPosts BlogPost[]
```

One new Prisma migration required.

---

## Role Permissions

| Action | ADMIN | AGENT |
|---|---|---|
| Create post | ✅ | ✅ (draft only) |
| Edit own post | ✅ | ✅ |
| Edit any post | ✅ | ❌ |
| Publish / unpublish | ✅ | ❌ |
| Delete post | ✅ | ❌ |

---

## Public `/news` Index Page

### Layout
- Navbar: transparent with scroll-aware logic. `data-navbar-theme="light"` on page wrapper so navbar shows dark logo/pills against off-white from scroll=0. Same behavior as buy/sell pages — no changes to Navbar.tsx.
- Background: `bg-[#F2F0EF]` throughout
- Page title: "News" in `text-[#1B1B1B]`, `pt-32` to clear navbar

### Sort Filter
- Single pill button top-right: toggles "Newest" / "Oldest"
- Sorts client-side (no page reload — all posts fetched via ISR)
- Styled with `PULSE_ANIMATE` + `SPRING_HOVER` matching site button standard

### Hero Post (most recent)
- Two-column row: cover image left (~58% width, `rounded-2xl`, `aspect-[16/9]`), text panel right
- Text panel: date in gold `text-[#9E8C61]`, title `font-sans font-light text-[2rem]`, excerpt, "Read More →" dark pill button
- Falls back to solid `bg-[#1B1B1B]` placeholder if no cover image

### Post Grid (all remaining posts)
- 3-column grid, `gap-8`, below the hero
- Each card: `rounded-2xl` cover image (`aspect-[16/9]`), gold date, title, 2-line clamped excerpt, "Read More →" link
- Cards fade up on scroll with `whileInView`
- If fewer than 2 posts exist: hero fills full width, grid hidden

---

## Public `/news/[slug]` Post Page

### Page Shell
- Navbar: same transparent + `data-navbar-theme="light"` as `/news`
- Background: `bg-[#F2F0EF]`, `pt-24` to clear navbar

### Cover Image
- Full-width `rounded-2xl` spanning the full content area at top
- Hidden gracefully if no cover image is set

### Two-Column Body Layout (below cover image)
- Left panel (~35% width, `sticky top-24`):
  - Date in gold
  - Large title (`font-sans font-light text-[2.5rem]`)
  - Author line in muted text (`text-[#1B1B1B]/50`)
  - `← Back to News` link at bottom
- Right panel (~65% width):
  - Tiptap-rendered HTML body with Tailwind `prose` typography (headings, lists, bold, links)

### "Other News" Section
- Separated by a thin border at the bottom of the page
- Heading: "Other News" in `font-sans font-light`
- 3-column grid of up to 3 most recent published posts excluding the current post. If fewer than 3 exist, renders however many are available without breaking the layout. Hidden entirely if no other posts exist.
- Same card style as `/news` index grid: `rounded-2xl` image, gold date, title

### SEO
- `generateMetadata` exports: `title`, `description` (from `excerpt`), OG image (from `coverImage`)
- Returns `notFound()` if slug doesn't exist or post is unpublished

---

## Admin Editor (`/admin/blog/new` and `/admin/blog/[id]/edit`)

### Fields
| Field | Type | Notes |
|---|---|---|
| Title | Text input | Auto-generates slug as you type |
| Slug | Text input | Auto-generated from title (e.g. "My Post" → `my-post`), manually editable. Deduplicates automatically by appending `-2`, `-3` etc. if slug already exists. |
| Excerpt | Short textarea | Used as card preview + SEO meta description |
| Cover Image URL | Text input | Live preview thumbnail renders beside it |
| Body | Tiptap editor | Reuses campaign builder Tiptap setup. Supports headings, bold, italic, lists, links, inline images via URL |
| Author Name | Text input | Pre-filled from logged-in user's name. Editable for AI-generated posts (e.g. "CnC Realty AI") |
| Published toggle | Pill toggle | ADMIN only. Sets `publishedAt` to now on first publish. AGENTs see "Pending Review" label. |

### Save Behavior
- "Save Draft" — always available, saves without publishing. On a new post this is the first action that creates the record and returns an ID.
- "Publish" — ADMIN only, sets `published: true`
- Auto-save every 30 seconds via `PUT /api/blog/[id]` — only activates after the first manual "Save Draft" (no ID exists before that)

### Admin Post List (`/admin/blog`)
- Table columns: thumbnail, title, status badge (Published / Draft), date, author, edit/delete actions
- ADMIN sees all posts; AGENT sees only their own
- Delete requires confirmation dialog; ADMIN only

---

## Cover Images

URL input for now. When Cloudflare R2 is wired up in Phase 7, the URL field is swapped for a file uploader — one-hour change, same field in the schema.

---

## Out of Scope (Phase 7 or later)
- Cloudflare R2 file upload for cover images
- Post categories or tags
- Comments
- Email newsletter on publish
- RSS feed
