# Add Lead Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Add Lead" button + modal to the agent Kanban view and the admin All Leads page so that any lead captured outside the website (referral, open house, cold call, etc.) can be entered directly into the CRM.

**Architecture:** Single reusable `NewLeadModal` client component POSTs to the existing `/api/leads` endpoint (which is already public and rate-limited). The Kanban wires in the modal and appends the returned lead to the "NEW" column without a page reload. The admin list page also gets the button but triggers a full page reload after save (simpler given the server-component list structure).

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS, Framer Motion (PULSE_ANIMATE/PULSE_TRANSITION/SPRING_HOVER from `@/lib/motion`), no toast library, gold `#9E8C61`, dark `#1B1B1B`, off-white `#F2F0EF`.

## Global Constraints

- No new API routes — POST to existing `/api/leads` (public endpoint, no auth header needed)
- No skeleton loaders — show loading state as button text change only
- No toast library — show inline success/error messages inside the modal
- Gold `#9E8C61` for the submit button, dark `#1B1B1B` for cancel
- All CTA buttons use `PULSE_ANIMATE + PULSE_TRANSITION + SPRING_HOVER` from `@/lib/motion`
- Modal overlay: `bg-black/50`, modal card: `bg-white rounded-2xl p-8 max-w-lg w-full`
- Input style matches existing CRM forms: `w-full rounded-lg border border-[#1B1B1B]/15 bg-[#F2F0EF] px-4 py-2.5 text-sm text-[#1B1B1B] focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/40`
- Source enum values (exact): `WEBSITE | REFERRAL | SOCIAL | OPEN_HOUSE | COLD_CALL | OTHER`
- Source labels: Website | Referral | Social Media | Open House | Cold Call | Other
- Default source: `OTHER` (since agents adding leads manually got them outside the website)
- On success in Kanban: prepend new lead to the "NEW" column state, close modal, clear form
- On success in admin list: `router.refresh()` then close modal (server component list re-fetches)

---

## Task 1: NewLeadModal component + Kanban + Admin wiring

**Files:**
- Create: `apps/web/src/components/leads/NewLeadModal.tsx`
- Modify: `apps/web/src/components/dashboard/LeadKanban.tsx`
- Modify: `apps/web/src/app/(dashboard)/admin/leads/AdminLeadsClient.tsx`

**Interfaces:**
- Produces: `NewLeadModal` — props: `open: boolean; onClose: () => void; onSaved?: (lead: { id: string; firstName: string; lastName: string; email: string; phone: string | null; status: string; createdAt: string }) => void`
- `onSaved` is called when the API returns 201; `onClose` is called when user dismisses without saving

- [ ] **Step 1: Write NewLeadModal**

Create `apps/web/src/components/leads/NewLeadModal.tsx`:

```tsx
"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

const SOURCE_OPTIONS = [
  { value: "OTHER", label: "Other" },
  { value: "REFERRAL", label: "Referral" },
  { value: "WEBSITE", label: "Website" },
  { value: "SOCIAL", label: "Social Media" },
  { value: "OPEN_HOUSE", label: "Open House" },
  { value: "COLD_CALL", label: "Cold Call" },
] as const;

type SavedLead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: (lead: SavedLead) => void;
}

const INPUT_CLS =
  "w-full rounded-lg border border-[#1B1B1B]/15 bg-[#F2F0EF] px-4 py-2.5 text-sm text-[#1B1B1B] focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/40";

export function NewLeadModal({ open, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    source: "OTHER" as string,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function reset() {
    setForm({ firstName: "", lastName: "", email: "", phone: "", source: "OTHER", notes: "" });
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          source: form.source,
          notes: form.notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to save lead.");
        return;
      }
      onSaved?.({
        id: json.id,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        status: "NEW",
        createdAt: new Date().toISOString(),
      });
      reset();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) { reset(); onClose(); } }}
        >
          <motion.div
            className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <h2 className="mb-6 font-sans text-xl font-light text-[#1B1B1B]">Add Lead</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-[#1B1B1B]/50">First Name *</label>
                  <input required className={INPUT_CLS} value={form.firstName} onChange={set("firstName")} placeholder="Jane" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#1B1B1B]/50">Last Name *</label>
                  <input required className={INPUT_CLS} value={form.lastName} onChange={set("lastName")} placeholder="Smith" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#1B1B1B]/50">Email *</label>
                <input required type="email" className={INPUT_CLS} value={form.email} onChange={set("email")} placeholder="jane@example.com" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#1B1B1B]/50">Phone</label>
                <input type="tel" className={INPUT_CLS} value={form.phone} onChange={set("phone")} placeholder="(555) 000-0000" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#1B1B1B]/50">Source</label>
                <select className={INPUT_CLS} value={form.source} onChange={set("source")}>
                  {SOURCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#1B1B1B]/50">Notes</label>
                <textarea rows={3} className={INPUT_CLS} value={form.notes} onChange={set("notes")} placeholder="How did you meet this lead?" />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <motion.button
                  type="button"
                  onClick={() => { reset(); onClose(); }}
                  className="rounded-full border border-[#1B1B1B]/20 px-5 py-2 text-sm text-[#1B1B1B]/60 hover:text-[#1B1B1B]"
                  whileHover={{ scale: 1.04, transition: SPRING_HOVER }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-[#9E8C61] px-6 py-2 text-sm text-white disabled:opacity-50"
                  animate={saving ? {} : PULSE_ANIMATE}
                  transition={saving ? {} : PULSE_TRANSITION}
                  whileHover={saving ? {} : { scale: 1.05, transition: SPRING_HOVER }}
                >
                  {saving ? "Saving…" : "Add Lead"}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Wire into LeadKanban**

In `apps/web/src/components/dashboard/LeadKanban.tsx`:

1. Import `NewLeadModal` and `useState` for modal open state (already imports useState)
2. Add `showModal` state: `const [showModal, setShowModal] = useState(false);`
3. Add `onSaved` handler that prepends the new lead (with status cast) to the `leads` state
4. Add an "Add Lead" button above the Kanban columns
5. Render `<NewLeadModal>` at the bottom of the return

The button placement: add a `div` above the `DndContext` with the button, inside a wrapper fragment:

```tsx
// Add to imports
import { NewLeadModal } from "@/components/leads/NewLeadModal";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

// Add state (alongside existing useState calls)
const [showModal, setShowModal] = useState(false);

// Handler
function handleLeadSaved(lead: { id: string; firstName: string; lastName: string; email: string; phone: string | null; status: string; createdAt: string }) {
  setLeads((prev) => [{ ...lead, status: "NEW" as LeadStatus }, ...prev]);
}

// Return: wrap existing return in a fragment, add button above DndContext
return (
  <>
    <div className="mb-4 flex justify-end">
      <motion.button
        onClick={() => setShowModal(true)}
        className="rounded-full bg-[#1B1B1B] px-5 py-2 text-sm text-white"
        animate={PULSE_ANIMATE}
        transition={PULSE_TRANSITION}
        whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
      >
        + Add Lead
      </motion.button>
    </div>
    <DndContext ...>
      {/* existing content unchanged */}
    </DndContext>
    <NewLeadModal open={showModal} onClose={() => setShowModal(false)} onSaved={handleLeadSaved} />
  </>
);
```

- [ ] **Step 3: Wire into AdminLeadsClient**

In `apps/web/src/app/(dashboard)/admin/leads/AdminLeadsClient.tsx`:

1. Import `NewLeadModal`, `useRouter` from next/navigation, and motion/pulse constants
2. Add `showModal` state and `router` instance
3. Add "Add Lead" button in the header section (near the top of the rendered JSX, alongside the tab switcher)
4. `onSaved` for admin: call `router.refresh()` then close modal (no optimistic update needed — the admin view is a server-rendered list)

```tsx
// Add to imports
import { NewLeadModal } from "@/components/leads/NewLeadModal";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

// Add inside component
const router = useRouter();
const [showModal, setShowModal] = useState(false);

function handleLeadSaved() {
  router.refresh();
  setShowModal(false);
}

// Add button near the tab row (before or after the tab buttons):
<div className="mb-4 flex items-center justify-between">
  {/* existing tab switcher stays here */}
  <motion.button
    onClick={() => setShowModal(true)}
    className="rounded-full bg-[#1B1B1B] px-5 py-2 text-sm text-white"
    animate={PULSE_ANIMATE}
    transition={PULSE_TRANSITION}
    whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
  >
    + Add Lead
  </motion.button>
</div>

// Add modal at bottom of return:
<NewLeadModal open={showModal} onClose={() => setShowModal(false)} onSaved={handleLeadSaved} />
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/leads/NewLeadModal.tsx \
        apps/web/src/components/dashboard/LeadKanban.tsx \
        apps/web/src/app/(dashboard)/admin/leads/AdminLeadsClient.tsx
git commit -m "feat: Add Lead button + modal in Kanban and admin leads page"
```

- [ ] **Step 5: Self-review checklist**
  - Modal closes and form resets on Cancel
  - Modal closes and form resets on backdrop click
  - New lead appears immediately in Kanban NEW column without page reload
  - Admin list refreshes after save
  - Error message shown inline on API failure
  - Submit button disabled during save
  - All pulse/spring animations applied
  - No new packages added
