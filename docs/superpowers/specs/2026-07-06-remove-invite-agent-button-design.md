# Remove "Invite Agent" Button — Design Spec

**Date:** 2026-07-06
**Status:** Approved

---

## Overview

The "Invite Agent" button on `/admin/agents` is a plain `<Link href="/join">` with no actual invite logic (no unique token, no pre-filled applicant info, no tracking of who invited whom) — it just navigates to the same public recruitment page anyone gets from the site nav. Ryan confirmed it's misleading as-is and asked to remove it cleanly.

---

## Change

**File:** `apps/web/src/app/(dashboard)/admin/agents/page.tsx`

- Remove the `<Link href="/join">Invite Agent</Link>` block (the button itself).
- Simplify the header wrapper's className from `"mb-6 flex items-center justify-between"` to `"mb-6"` — the `flex items-center justify-between` existed solely to push the button to the right of the "All Agents" heading; with nothing to space against, it's dead styling.
- The `Link` import at the top of the file stays — it's still used elsewhere in the same file for each agent's name linking to `/agents/{slug}` (an unrelated, independent usage).

## Out of Scope

- No replacement invite mechanism is being built. If a real "invite a specific person" flow is wanted later, that's separate, future work.
- No other button, column, or table behavior on this page changes.
