# Task 11 Report — Auto-Tagging & Property View Tracking

## Status: DONE

## Part 1: Auto-Tagging on Lead Creation

**File modified:** `apps/web/src/app/api/leads/route.ts`

- Added `import { applyTag } from "@/lib/tags"` at the top
- After `prisma.lead.create(...)`, added fire-and-forget Open House auto-tag:
  ```ts
  if (data.source === "OPEN_HOUSE") {
    applyTag(lead.id, "Open House").catch(console.error);
  }
  ```

**Does the lead creation body include `mlsNumber` or `propertyId`?** No. The `createSchema` only has `firstName`, `lastName`, `email`, `phone`, `notes`, and `source`. City auto-tagging was skipped per instructions — will be wired when the contact form is updated to include `mlsNumber`.

**Auto-tags wired up:** Open House only.

## Part 2: Property View Tracking

**Property detail page found at:** `apps/web/src/app/(listings)/properties/[mlsNumber]/page.tsx`

The MLS number param is `params.mlsNumber`.

- Added `import { getServerSession } from "next-auth"` and `import { authOptions } from "@/lib/auth"`
- After `if (!property) notFound()`, added fire-and-forget view tracking:
  ```ts
  const session = await getServerSession(authOptions);
  if (session?.user && (session.user as any).role === "BUYER") {
    prisma.propertyView.create({
      data: { userId: (session.user as any).id, mlsNumber: params.mlsNumber },
    }).catch(() => {});
  }
  ```

## TypeScript Check

`pnpm --filter web exec tsc --noEmit` — all errors shown are pre-existing (test files, `@prisma/client` module resolution, `PULSE_ANIMATE` readonly tuple, `ZodError.errors`). Zero new type errors introduced by these changes.

## Notes / Concerns

- The `err.errors[0].message` on line 46 of `leads/route.ts` is a pre-existing TypeScript error (Zod v4 changed `.errors` to `.issues`) — not caused by this task.
- City auto-tagging is intentionally deferred until `mlsNumber` is added to the lead creation payload in a future sub-project.
