# ManageHandle Contact Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Learn More" links on ManageHandle photo cards with a popup contact form modal that tags leads by service card.

**Architecture:** Two-file change — new `ManageContactModal.tsx` owns the modal UI and form logic; `ManageHandle.tsx` adds open/activeCard state and renders the modal. The modal POSTs to the existing `/api/leads` endpoint with a `MANAGE_<SERVICE>` source tag.

**Tech Stack:** Next.js 14, Framer Motion (`motion/react`), Tailwind CSS, existing `/api/leads` POST endpoint, `useClickOutside` hook, `NAV_PANEL_CLS` / `NAV_ITEM_CLS` / `PULSE_ANIMATE` / `PULSE_TRANSITION` / `SPRING_HOVER` from `@/lib/motion`.

---

### Task 1: Create ManageContactModal component

**Files:**
- Create: `apps/web/src/components/manage/ManageContactModal.tsx`

- [ ] **Step 1: Create the file with imports and constants**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useClickOutside } from "@/hooks/useClickOutside";
import {
  NAV_PANEL_CLS,
  NAV_ITEM_CLS,
  PULSE_ANIMATE,
  PULSE_TRANSITION,
  SPRING_HOVER,
} from "@/lib/motion";

const ROLE_OPTIONS = [
  "Home Buyer",
  "Home Seller",
  "Home Owner",
  "Renter",
  "Landlord",
  "Property Manager",
];

interface ManageContactModalProps {
  open: boolean;
  cardTitle: string;
  onClose: () => void;
}
```

- [ ] **Step 2: Add form state and submission logic**

```tsx
export function ManageContactModal({ open, cardTitle, onClose }: ManageContactModalProps) {
  const [form, setForm] = useState({ email: "", role: "", notes: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleError, setRoleError] = useState(false);

  const roleRef = useRef<HTMLDivElement>(null);

  // useClickOutside is only needed for the role dropdown
  useClickOutside(roleRef, () => setRoleOpen(false));

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setForm({ email: "", role: "", notes: "" });
      setStatus("idle");
      setRoleError(false);
    }
  }, [open]);

  // Auto-close after success
  useEffect(() => {
    if (status !== "success") return;
    const t = setTimeout(onClose, 2000);
    return () => clearTimeout(t);
  }, [status, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.role) { setRoleError(true); return; }
    setStatus("loading");
    const source = "MANAGE_" + cardTitle.toUpperCase().replace(/\s+/g, "_");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }
```

- [ ] **Step 3: Add the modal JSX and close the component**

```tsx
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-2xl bg-white p-10"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-6 top-6 text-[#1B1B1B]/40 transition-colors hover:text-[#1B1B1B]"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            <h2 className="font-sans text-[2rem] font-light leading-tight text-[#1B1B1B]">
              Let&apos;s Chat
            </h2>
            <p className="mt-1 mb-8 font-sans text-sm text-[#1B1B1B]/50">
              We&apos;re super responsive!
            </p>

            {status === "success" ? (
              <div className="py-8 text-center">
                <p className="font-sans text-lg font-light text-[#1B1B1B]">Message received.</p>
                <p className="mt-2 font-sans text-sm text-[#1B1B1B]/50">We&apos;ll be in touch soon.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-sans text-sm text-[#1B1B1B]/60">Email *</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60"
                    placeholder="your@email.com"
                  />
                </div>

                {/* I am a */}
                <div className="flex flex-col gap-1.5" ref={roleRef}>
                  <label className={`font-sans text-sm ${roleError ? "text-red-500" : "text-[#1B1B1B]/60"}`}>
                    I am a *
                  </label>
                  <button
                    type="button"
                    onClick={() => { setRoleOpen((o) => !o); setRoleError(false); }}
                    className="flex items-center justify-between border-b py-2 font-sans text-base transition-colors focus:outline-none"
                    style={{ borderColor: roleError ? "rgb(239,68,68)" : roleOpen ? "rgba(27,27,27,0.6)" : "rgba(27,27,27,0.2)" }}
                  >
                    <span className={form.role ? "text-[#1B1B1B]" : "text-[#1B1B1B]/30"}>
                      {form.role || "Select one…"}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                      className={`transition-transform duration-200 ${roleOpen ? "rotate-180" : ""}`}>
                      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#1B1B1B]/40" />
                    </svg>
                  </button>
                  {roleOpen && (
                    <div className="relative z-50">
                      <div className={`absolute left-0 top-1 w-52 ${NAV_PANEL_CLS}`}>
                        {ROLE_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => { setForm((f) => ({ ...f, role: opt })); setRoleOpen(false); }}
                            className={`${NAV_ITEM_CLS} ${form.role === opt ? "text-[#c9a84c]" : "text-white/80"}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Message */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-sans text-sm text-[#1B1B1B]/60">Message *</label>
                  <textarea
                    rows={4}
                    required
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="resize-none border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60"
                    placeholder="Tell us what you're looking for…"
                  />
                </div>

                {status === "error" && (
                  <p className="font-sans text-sm text-red-500">Something went wrong. Please try again.</p>
                )}

                <motion.button
                  type="submit"
                  disabled={status === "loading"}
                  animate={PULSE_ANIMATE}
                  transition={PULSE_TRANSITION}
                  whileHover={{ scale: 1.02, transition: SPRING_HOVER }}
                  className="w-full rounded-full bg-[#1B1B1B] py-3.5 font-sans text-sm font-medium text-white disabled:opacity-40"
                >
                  {status === "loading" ? "Sending…" : "Send Message"}
                </motion.button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Verify the file compiles — check the dev server terminal for TypeScript errors**

Expected: no red errors in the Next.js dev server output.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/manage/ManageContactModal.tsx
git commit -m "feat(manage): add ManageContactModal component"
```

---

### Task 2: Wire modal into ManageHandle

**Files:**
- Modify: `apps/web/src/components/manage/ManageHandle.tsx`

- [ ] **Step 1: Add modal import and remove `Link` import (it's no longer used in cards)**

At the top of `ManageHandle.tsx`, add the import and swap `Link` usage. The full updated imports block:

```tsx
"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { RevealLine } from "@/components/ui/reveal-text";
import { fadeUp, PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { ManageContactModal } from "./ManageContactModal";
```

(`Link` is removed — no longer needed.)

- [ ] **Step 2: Remove `href` from every card in the `CARDS` array**

```tsx
const CARDS = [
  {
    title: "Tenant Placement",
    body: "We market your property on CRMLS and major platforms, screen applicants thoroughly, and place qualified tenants fast.",
    image: "/images/manage-tenant-placement.jpg",
  },
  {
    title: "Rent Collection",
    body: "Automated rent collection with direct deposit to your account. Late payments handled professionally so you don't have to.",
    image: "/images/manage-rent-collection.jpg",
  },
  {
    title: "Maintenance Coordination",
    body: "24/7 maintenance request line. We coordinate with licensed vendors, get multiple bids, and keep you informed at every step.",
    image: "/images/manage-maintenance.jpg",
  },
  {
    title: "Financial Reporting",
    body: "Monthly income and expense statements, annual reports for tax prep, and a live owner portal to see everything in real time.",
    image: "/images/manage-financial-reporting.jpg",
  },
  {
    title: "Lease Management",
    body: "California-compliant leases, renewals, rent increase notices, and move-out inspections — all handled by our team.",
    image: "/images/manage-lease.jpg",
  },
  {
    title: "Eviction Protection",
    body: "When necessary, we follow California eviction law precisely and work with our legal partners to protect your investment.",
    image: "/images/manage-eviction.jpg",
  },
];
```

- [ ] **Step 3: Update `CardRow` to accept and call `onLearnMore`**

Replace the `CardRow` function signature and the `<Link>` button:

```tsx
function CardRow({
  cards,
  rowClass,
  onLearnMore,
}: {
  cards: typeof CARDS;
  rowClass: string;
  onLearnMore: (title: string) => void;
}) {
  return (
    <div className={`${rowClass} grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-[20px]`}>
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          {...fadeUp(0.1 + i * 0.08)}
          className="manage-handle-card relative overflow-hidden h-[400px] md:h-[470px] rounded-2xl md:rounded-xl grid content-end gap-5 p-8 md:p-[50px]"
        >
          <div className="absolute inset-0">
            <img
              src={card.image}
              alt={card.title}
              className="w-full h-full object-cover scale-[1.01]"
            />
            <div className="absolute inset-0 bg-black/40" />
          </div>
          <h3 className="relative font-sans font-medium text-[28px] leading-[115%] tracking-[-0.01em] max-w-[85%] md:text-[42px] md:tracking-[-0.02em]">
            {card.title}
          </h3>
          <p className="card-handle-text relative font-sans text-sm leading-relaxed text-white/75 md:text-base">
            {card.body}
          </p>
          <div className="relative">
            <motion.div
              animate={PULSE_ANIMATE}
              transition={PULSE_TRANSITION}
              whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
              className="w-fit"
            >
              <button
                onClick={() => onLearnMore(card.title)}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/20 backdrop-blur-sm px-6 py-3 font-sans text-sm font-medium text-white transition-colors hover:border-white/70"
              >
                Learn More
              </button>
            </motion.div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Add state and wire up modal in `ManageHandle`**

Replace the `ManageHandle` export:

```tsx
export function ManageHandle() {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCard, setActiveCard] = useState("");

  function handleLearnMore(title: string) {
    setActiveCard(title);
    setModalOpen(true);
  }

  return (
    <section data-navbar-theme="dark" className="bg-[#1B1B1B] text-white py-24 md:py-[150px] overflow-hidden">
      <style>{`
        .manage-handle-row-1,
        .manage-handle-row-2,
        .manage-handle-row-3 {
          transition: grid-template-columns 1s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (min-width: 768px) and (pointer: fine) {
          .manage-handle-row-1:has(.manage-handle-card:nth-child(1):hover) { grid-template-columns: 1.2fr 0.8fr; }
          .manage-handle-row-1:has(.manage-handle-card:nth-child(2):hover) { grid-template-columns: 0.8fr 1.2fr; }
          .manage-handle-row-2:has(.manage-handle-card:nth-child(1):hover) { grid-template-columns: 1.2fr 0.8fr; }
          .manage-handle-row-2:has(.manage-handle-card:nth-child(2):hover) { grid-template-columns: 0.8fr 1.2fr; }
          .manage-handle-row-3:has(.manage-handle-card:nth-child(1):hover) { grid-template-columns: 1.2fr 0.8fr; }
          .manage-handle-row-3:has(.manage-handle-card:nth-child(2):hover) { grid-template-columns: 0.8fr 1.2fr; }
          .manage-handle-card .card-handle-text { opacity: 0; transition: opacity 0.4s ease; }
          .manage-handle-card:hover .card-handle-text { opacity: 1; }
        }
      `}</style>

      <div className="mx-auto max-w-[1920px] px-10 md:px-[100px]">
        <div className="mb-16 flex justify-end">
          <h2 className="font-sans text-[2.5rem] font-light xl:text-[3rem]">
            <RevealLine>
              <span className="text-[1.9rem] xl:text-[2.2rem] text-white/80">Our </span>
              <span className="text-cnc-gold font-medium">Services</span>
            </RevealLine>
          </h2>
        </div>

        <CardRow cards={ROW_1} rowClass="manage-handle-row-1" onLearnMore={handleLearnMore} />
        <CardRow cards={ROW_2} rowClass="manage-handle-row-2 mt-3 md:mt-[20px]" onLearnMore={handleLearnMore} />
        <CardRow cards={ROW_3} rowClass="manage-handle-row-3 mt-3 md:mt-[20px]" onLearnMore={handleLearnMore} />
      </div>

      <ManageContactModal
        open={modalOpen}
        cardTitle={activeCard}
        onClose={() => setModalOpen(false)}
      />
    </section>
  );
}
```

- [ ] **Step 5: Verify in browser**

1. Open `http://localhost:3000/manage`
2. Scroll to "Our Services"
3. Click "Learn More" on any card → modal opens with "Let's Chat" heading
4. Verify the card title is captured (check Network tab → `/api/leads` payload → `source` field = `MANAGE_<CARD_TITLE>`)
5. Fill in email, select a role, type a message → click Send
6. Verify success state appears, then modal auto-closes after 2 seconds
7. Click backdrop → modal closes
8. Press Escape → modal closes

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/manage/ManageHandle.tsx
git commit -m "feat(manage): wire ManageContactModal into photo cards"
```
