# Agent Profile Editing in Dashboard Settings

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the dashboard settings page to a two-column layout where the right column lets agents upload a headshot, edit bio, years of experience, and social links — all without leaving the settings page.

**Architecture:** Two new API routes (agent profile GET/PATCH + headshot proxy), expand the existing settings page into a grid layout with a right column agent profile card. Headshots upload directly to Cloudflare R2 via presigned PUT URL, then stored as an R2 key in `agent.headshot`. A server-side proxy route serves the headshot image so it never exposes a raw signed URL.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Prisma ORM, Tailwind CSS, Cloudflare R2 (@aws-sdk/client-s3 + presigner already configured in `apps/web/src/lib/r2.ts`)

## Global Constraints

- Gold accent: `#9E8C61` — use for focus rings and active states
- Off-white bg: `#F2F0EF` — avatar placeholder background
- Text: `#1B1B1B` and `#1B1B1B/50` for labels
- All API routes must use `requireAuth` from `@/lib/api-auth`
- No toast library — use inline state messages (same pattern as existing settings page)
- R2 already configured in `apps/web/src/lib/r2.ts` with `getPresignedPutUrl`, `getPresignedGetUrl`, `R2_BUCKET`
- Agent headshot R2 key format: `headshots/${userId}` (no extension — R2 stores content-type separately)
- Settings page is at `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`

---

### Task 1: Backend — Agent Profile API + Headshot Proxy

**Files:**
- Create: `apps/web/src/app/api/account/agent-profile/route.ts`
- Create: `apps/web/src/app/api/account/headshot-upload-url/route.ts`
- Create: `apps/web/src/app/api/headshot/[userId]/route.ts`
- Modify: `apps/web/src/app/(agents)/agents/[slug]/page.tsx`

**Interfaces:**

`GET /api/account/agent-profile` → `{ bio, yearsExp, instagram, facebook, linkedin, headshot }`
  - All fields nullable/optional
  - `headshot` is the raw R2 key string (e.g. `"headshots/abc123"`) or null

`PATCH /api/account/agent-profile` body: `{ bio?, yearsExp?, instagram?, facebook?, linkedin?, headshot? }`
  - All fields optional; only update fields present in body
  - `yearsExp` is a number or null
  - Returns `{ success: true }`

`GET /api/account/headshot-upload-url?contentType=image/jpeg` → `{ uploadUrl, key }`
  - `key` is always `headshots/${session.user.id}`
  - `uploadUrl` is presigned R2 PUT URL (5 min expiry)
  - Only allow `image/jpeg`, `image/png`, `image/webp`

`GET /api/headshot/[userId]` → 302 redirect to presigned R2 GET URL
  - Look up agent by `userId`, get `agent.headshot` key
  - If no agent or no headshot key: return 404
  - Otherwise: generate presigned GET URL (15 min expiry) and redirect

**Agent profile page update:**
- `apps/web/src/app/(agents)/agents/[slug]/page.tsx` currently passes `headshot={agent.headshot}` (raw R2 key) to `AgentProfileHero`
- Change to: `headshot={agent.headshot ? `/api/headshot/${agent.userId}` : null}`
- `agent.userId` is available in the Prisma result (add it to the select/findUnique if not already present)

- [ ] **Step 1: Create `GET /api/account/agent-profile`**

```typescript
// apps/web/src/app/api/account/agent-profile/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const agent = await prisma.agent.findUnique({
    where: { userId: session.user.id },
    select: { bio: true, yearsExp: true, instagram: true, facebook: true, linkedin: true, headshot: true },
  });
  return NextResponse.json(agent ?? {});
}
```

- [ ] **Step 2: Add `PATCH /api/account/agent-profile`**

```typescript
export async function PATCH(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const { bio, yearsExp, instagram, facebook, linkedin, headshot } = body;

  const data: Record<string, unknown> = {};
  if (bio !== undefined) data.bio = bio || null;
  if (yearsExp !== undefined) data.yearsExp = yearsExp !== null ? Number(yearsExp) : null;
  if (instagram !== undefined) data.instagram = instagram || null;
  if (facebook !== undefined) data.facebook = facebook || null;
  if (linkedin !== undefined) data.linkedin = linkedin || null;
  if (headshot !== undefined) data.headshot = headshot || null;

  try {
    await prisma.agent.updateMany({
      where: { userId: session.user.id },
      data,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[agent-profile PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create `GET /api/account/headshot-upload-url`**

```typescript
// apps/web/src/app/api/account/headshot-upload-url/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getPresignedPutUrl, R2_BUCKET } from "@/lib/r2";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function GET(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const contentType = searchParams.get("contentType") ?? "";

  if (!ALLOWED.includes(contentType)) {
    return NextResponse.json({ error: "Only JPEG, PNG, and WebP allowed" }, { status: 400 });
  }

  const key = `headshots/${session.user.id}`;
  const uploadUrl = await getPresignedPutUrl(key, contentType);
  return NextResponse.json({ uploadUrl, key });
}
```

- [ ] **Step 4: Create `GET /api/headshot/[userId]`**

```typescript
// apps/web/src/app/api/headshot/[userId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPresignedGetUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  const agent = await prisma.agent.findUnique({
    where: { userId: params.userId },
    select: { headshot: true },
  });

  if (!agent?.headshot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = await getPresignedGetUrl(agent.headshot);
  return NextResponse.redirect(url);
}
```

- [ ] **Step 5: Update agent profile page to use proxy URL**

In `apps/web/src/app/(agents)/agents/[slug]/page.tsx`, update `getAgent` to also select `userId`:

```typescript
const getAgent = cache((slug: string) =>
  prisma.agent.findUnique({ where: { slug }, select: { ... all existing fields ..., userId: true } })
);
```

Then pass to `AgentProfileHero`:
```tsx
headshot={agent.headshot ? `/api/headshot/${agent.userId}` : null}
```

- [ ] **Step 6: Verify TypeScript compiles** — run `pnpm --filter web tsc --noEmit` from repo root

- [ ] **Step 7: Commit**
```bash
git add apps/web/src/app/api/account/agent-profile/route.ts \
        apps/web/src/app/api/account/headshot-upload-url/route.ts \
        apps/web/src/app/api/headshot/[userId]/route.ts \
        apps/web/src/app/(agents)/agents/[slug]/page.tsx
git commit -m "feat: agent profile API + headshot proxy route"
```

---

### Task 2: Settings Page — Two-Column Layout + Agent Profile Form

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`

**What to build:**
- Change outer container from `flex flex-col gap-5 max-w-lg` to a two-column CSS grid: `grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-5xl`
- Left column: existing cards (Profile with name/license, Password, Account/sign out)
- **Remove** the "Public Agent Profile" card that just had an "Edit Profile" link — it's now replaced by the right column
- Right column: single "Agent Profile" card containing:
  1. **Headshot section**: 80px circle avatar (shows image from `/api/headshot/${session.user.id}` or initial letter placeholder), "Change Photo" button triggers hidden file input
  2. **Bio**: `<textarea>` label "Bio", placeholder "Tell clients about yourself…", 3 rows
  3. **Years of Experience**: `<input type="number">` label "Years of Experience", min=0
  4. **Social links**: three text inputs for Instagram URL, Facebook URL, LinkedIn URL
  5. **Save Agent Profile** button — calls PATCH /api/account/agent-profile

**State needed (right column):**
```typescript
const [agentProfile, setAgentProfile] = useState({ bio: "", yearsExp: "", instagram: "", facebook: "", linkedin: "", headshot: null as string | null });
const [profileSaving, setProfileSaving] = useState(false);
const [profileMsg, setProfileMsg] = useState<string | null>(null);
const [headshotUploading, setHeadshotUploading] = useState(false);
const [headshotKey, setHeadshotKey] = useState<string | null>(null);
```

**Load on mount:**
```typescript
useEffect(() => {
  fetch("/api/account/agent-profile")
    .then((r) => r.ok ? r.json() : null)
    .then((d) => {
      if (!d) return;
      setAgentProfile({
        bio: d.bio ?? "",
        yearsExp: d.yearsExp?.toString() ?? "",
        instagram: d.instagram ?? "",
        facebook: d.facebook ?? "",
        linkedin: d.linkedin ?? "",
        headshot: d.headshot ?? null,
      });
      if (d.headshot) setHeadshotKey(d.headshot);
    })
    .catch(() => {});
}, []);
```

**Headshot upload handler:**
```typescript
async function handleHeadshotChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    setProfileMsg("Only JPEG, PNG, or WebP images allowed.");
    return;
  }
  setHeadshotUploading(true);
  setProfileMsg(null);
  try {
    const { uploadUrl, key } = await fetch(
      `/api/account/headshot-upload-url?contentType=${encodeURIComponent(file.type)}`
    ).then((r) => r.json());
    await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    await fetch("/api/account/agent-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headshot: key }),
    });
    setHeadshotKey(key);
    setProfileMsg("Photo updated.");
  } catch {
    setProfileMsg("Photo upload failed. Try again.");
  } finally {
    setHeadshotUploading(false);
  }
}
```

**Save agent profile handler:**
```typescript
async function handleSaveAgentProfile(e: React.FormEvent) {
  e.preventDefault();
  setProfileSaving(true);
  setProfileMsg(null);
  try {
    const res = await fetch("/api/account/agent-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bio: agentProfile.bio,
        yearsExp: agentProfile.yearsExp !== "" ? Number(agentProfile.yearsExp) : null,
        instagram: agentProfile.instagram,
        facebook: agentProfile.facebook,
        linkedin: agentProfile.linkedin,
      }),
    });
    if (!res.ok) throw new Error("Failed");
    setProfileMsg("Agent profile updated.");
  } catch {
    setProfileMsg("Something went wrong. Try again.");
  } finally {
    setProfileSaving(false);
  }
}
```

**Headshot avatar JSX** (shows image if headshotKey set, otherwise initial letter):
```tsx
<div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[#F2F0EF]">
  {headshotKey ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/headshot/${(session as any)?.user?.id}?t=${headshotKey}`}
      alt="Headshot"
      className="h-full w-full object-cover"
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center">
      <span className="font-sans text-2xl font-light text-[#1B1B1B]/20">
        {(session?.user?.name ?? "A")[0].toUpperCase()}
      </span>
    </div>
  )}
</div>
```

- [ ] **Step 1: Add state variables and useEffect for agent profile load**
- [ ] **Step 2: Add headshot upload handler**
- [ ] **Step 3: Add save agent profile handler**
- [ ] **Step 4: Change layout to 2-column grid, remove "Public Agent Profile" link card**
- [ ] **Step 5: Build right column agent profile card with headshot, bio, yearsExp, social fields**
- [ ] **Step 6: Verify TypeScript compiles** — run `pnpm --filter web tsc --noEmit`
- [ ] **Step 7: Commit**
```bash
git add apps/web/src/app/(dashboard)/dashboard/settings/page.tsx
git commit -m "feat: agent profile editing in settings page with headshot upload"
```
