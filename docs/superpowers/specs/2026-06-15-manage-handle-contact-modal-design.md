# ManageHandle Contact Modal — Design Spec

**Date:** 2026-06-15
**Status:** Approved

---

## Overview

Replace the "Learn More" `<Link>` buttons on the ManageHandle photo cards with a popup contact modal. The modal collects email, role, and message, then POSTs to `/api/leads` tagged with the specific service card that triggered it. No full-page navigation.

---

## Architecture

Two files are touched:

| File | Change |
|---|---|
| `apps/web/src/components/manage/ManageHandle.tsx` | Add `open` + `activeCard` state; swap `<Link>` → `<button>`; render `<ManageContactModal>` |
| `apps/web/src/components/manage/ManageContactModal.tsx` | New file — modal UI + form logic |

The `href` field on each `CARDS` entry is removed (no longer needed).

---

## ManageContactModal

### Props

```ts
interface ManageContactModalProps {
  open: boolean;
  cardTitle: string;        // e.g. "Tenant Placement"
  onClose: () => void;
}
```

### Layout

- Full-screen backdrop: `fixed inset-0 z-50 flex items-center justify-center bg-black/60`
- White modal card: `bg-white rounded-2xl p-10 w-full max-w-lg mx-4 relative`
- Close button: top-right `×` icon, closes on click
- Backdrop click also closes the modal
- `motion.div` fade-in/out via `AnimatePresence` + `opacity: 0→1`, `y: 8→0`

### Form Fields

1. **Email** — `<input type="email" required>` — label "Email *"
2. **I am a** — custom dropdown using same `ROLE_OPTIONS` + `NAV_PANEL_CLS` / `NAV_ITEM_CLS` as the contact page
3. **Message** — `<textarea rows={4} required>` — label "Message *"

All inputs use the same underline style as the contact page: `border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base`.

### Heading

```
Let's Chat          ← font-sans text-[2rem] font-light
We're super responsive!  ← text-sm text-[#1B1B1B]/50
```

### Submit Button

Dark pill, full-width: `w-full rounded-full bg-[#1B1B1B] py-3.5 font-sans text-sm font-medium text-white`
Apply `PULSE_ANIMATE` + `PULSE_TRANSITION` + `SPRING_HOVER` (matches sitewide CTA standard).

### Form State

```ts
{ email: "", role: "", notes: "" }
```

Status: `"idle" | "loading" | "success" | "error"`

### Submission

POST to `/api/leads`:

```json
{
  "email": "...",
  "role": "...",
  "notes": "...",
  "source": "MANAGE_TENANT_PLACEMENT"   // MANAGE_ + cardTitle uppercased, spaces → underscores
}
```

Source format: `"MANAGE_" + cardTitle.toUpperCase().replace(/\s+/g, "_")`

### Success State

Replace form with centered confirmation:
```
Message received.
We'll be in touch soon.
```
Then auto-close modal after 2 seconds.

### Error State

Inline error below submit: `"Something went wrong. Please try again."`

---

## ManageHandle Changes

- Add state: `const [modalOpen, setModalOpen] = useState(false)` and `const [activeCard, setActiveCard] = useState("")`
- Remove `href` from each card in `CARDS`
- Replace `<Link href={card.href}>Learn More</Link>` with `<button onClick={() => { setActiveCard(card.title); setModalOpen(true); }}>Learn More</button>` (keep existing pill + pulse styling)
- Render `<ManageContactModal open={modalOpen} cardTitle={activeCard} onClose={() => setModalOpen(false)} />` below the grid

---

## Accessibility

- Modal traps focus while open (via `autoFocus` on first input)
- `Escape` key closes the modal
- Backdrop click closes the modal

---

## Out of Scope

- First name / last name / phone fields (contact page has these; modal intentionally minimal)
- Persisting form state between opens (resets each time)
- Analytics events
