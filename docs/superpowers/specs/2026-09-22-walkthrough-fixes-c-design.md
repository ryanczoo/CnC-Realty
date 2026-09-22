# Walkthrough fixes — Sub-project C: input rules

**Date:** 2026-09-22
**Origin:** Found during the live Purchase-transaction walkthrough (see sub-project A spec, `2026-09-20-walkthrough-fixes-a-design.md`), and one item Ryan raised live while verifying sub-project B (`2026-09-21-walkthrough-fixes-b-design.md`).
**Scope:** three input-rule fixes in the New Transaction wizard, and a server-side whitespace trim applied everywhere text is saved on a file.
**Explicitly out:** New Listing's wizard has no Parties step (parties are added one at a time on the file's own Parties tab, already fixed in A), so it needs none of this. Sub-project D (commission redesign) is separate.

## Reuse audit (done before designing)

| Need | Already in the codebase? | Decision |
|---|---|---|
| Field input | `components/ui/FormField.tsx` — shared by New Transaction and New Listing, with a `restrict` hook already used for digit-stripping. | Reuse as-is; nothing about these three fixes needs a client-side `restrict`. |
| Party role → label | `escrowTypeToRole` in `lib/transaction-helpers.ts` (Title/Escrow/Attorney → TITLE/ESCROW/ATTORNEY), and `PartiesTable.tsx`'s `ROLE_LABELS` already has all three. | Reuse; no schema or role-label change needed. |
| Section add/remove for a list of parties | `PartySection` (local to the wizard) already handles Buyers/Sellers as an array with add/remove. | Reuse for the two required-party sections; the label becomes a prop instead of a literal. |
| A "trim" utility | None. `lib/form-validation.ts` has phone formatting, email validation, and digit-stripping helpers, but nothing trims whitespace, client or server. No route calls `.trim()` anywhere. | Add one small function there; it is a plain module, safe to import from server routes. |
| Where required-ness is enforced today | `canAdvance` in the wizard already gates Steps 0–2 the same way (a `useMemo` returning a boolean); Step 3 (Parties) currently just falls through to `true`. | Extend the same `useMemo`, no new mechanism. |

## The fixes

### 1. Required parties, gated by side

`canAdvance`'s Step 3 case changes from `true` to a check based on `form.transactionSide`:

| Side | Required | Check |
|---|---|---|
| PURCHASE | Buyer | `buyers.some(b => b.name)` |
| LISTING | Seller | `sellers.some(s => s.name)` |
| DUAL | Both | both of the above |
| LEASE_TENANT | Tenant (the buyer-role section) | `buyers.some(b => b.name)` |
| LEASE_LANDLORD | Landlord (the seller-role section) | `sellers.some(s => s.name)` |
| LEASE_DUAL | Both | both |
| REFERRAL | n/a | Step 3 doesn't exist for referral (its own 3-step flow) |

Next stays silently disabled when the check fails, exactly like Steps 0–2 today — no new error-message pattern is introduced.

**Section labels change with the side**, using the wizard's existing `isLeaseSide` boolean:
- Lease sides (`LEASE_TENANT`, `LEASE_LANDLORD`, `LEASE_DUAL`): the buyer-role section is labeled "Tenants", the seller-role section "Landlords".
- Everything else (`PURCHASE`, `LISTING`, `DUAL`): "Buyers" / "Sellers", unchanged.

Both sections keep rendering for every side (an agent can still optionally note the other side's contact if known); only the label and which one blocks Next change. `PartySection`'s `singular` derivation (`label.slice(0, -1)`) already works unchanged for "Tenants"/"Landlords".

### 2. Title / Escrow / Attorney — one toggle, three remembered contacts

Replace the single `titleEscrow: TitleEscrowParty` state with three independent `Party` objects (Title, Escrow, Attorney) plus a separate `activeEscrowType` state that the toggle buttons set. The toggle only changes which of the three sets of fields is visible; it no longer touches the data.

```ts
const [escrowContacts, setEscrowContacts] = useState<Record<EscrowContactType, Party>>({
  Title: emptyParty(), Escrow: emptyParty(), Attorney: emptyParty(),
});
const [activeEscrowType, setActiveEscrowType] = useState<EscrowContactType>("Escrow");
```

The toggle buttons set `activeEscrowType` only. The four `Field`s below read from and write to `escrowContacts[activeEscrowType]`.

At submit, every type with a name gets its own party, using the existing `escrowTypeToRole` mapping — the same pattern the current single-object code already uses, just repeated over the three keys instead of one:

```ts
...(["Title", "Escrow", "Attorney"] as const)
  .filter((t) => escrowContacts[t].name)
  .map((t) => ({ role: escrowTypeToRole(t), ...escrowContacts[t] }))
```

The Review step shows one `ReviewRow` per filled-in type instead of the single conditional row it has today. `EscrowContactType` (already exported from `lib/transaction-helpers.ts`) is reused for the state's key type — no new type.

Nothing about this needs `escrowNumber` or any other unrelated wizard field, and it needs no schema change: `TITLE`/`ESCROW`/`ATTORNEY` are already valid `FilePartyRole` values (added in sub-project A), and a file can already hold multiple parties.

### 3. Server-side whitespace trim

One function, added to `lib/form-validation.ts`:

```ts
// Trims every string in a JSON-shaped value, recursing into plain objects and
// arrays; leaves numbers, booleans, null and Dates untouched. Applied once per
// route, right after parsing the request body, so no caller has to remember
// to trim any individual field.
export function trimStrings<T>(value: T): T {
  if (typeof value === "string") return value.trim() as unknown as T;
  if (Array.isArray(value)) return value.map(trimStrings) as unknown as T;
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = trimStrings(v);
    return out as T;
  }
  return value;
}
```

Applied at the top of every route that saves agent-typed text, right after `req.json()`, replacing `const body = await req.json();` with `const body = trimStrings(await req.json());` (or wrapping the destructured parse the same way):

- `POST /api/transactions`, `POST /api/listings` — trims the whole body, including the nested `parties` array, in one call.
- `PATCH /api/transactions/[id]`, `PATCH /api/listings/[id]`
- `POST /api/files/[fileType]/[id]/parties`, `PATCH .../parties/[partyId]`
- `POST /api/file-tasks`, `PATCH /api/file-tasks/[taskId]`
- `POST /api/files/[fileType]/[id]/note`
- `POST /api/transactions/[id]/conditions`

This covers the wizard, the Add Party form, and every other place an agent types text onto a file, with one change per route rather than one per field. Nothing about `changeFileStatus` or the closed-file lock (sub-project B) changes; trimming happens before those checks run, on the same body they already read.

## Testing

- `trimStrings`: pure function, tests for a flat object, a nested object, an array of objects (matching the `parties` shape), and that numbers/booleans/null/Date pass through untouched.
- Each touched route: one test asserting a field with leading/trailing whitespace in the request body is stored trimmed.
- `canAdvance`'s Step 3 logic: no route change, so this is UI-only — verified with `tsc`, the full suite, and a live check with Ryan, as in A and B (one pass per side: Purchase, Listing, Dual, a lease side).
- The escrow contacts: live check only (typing into each of the three, switching between them, confirming nothing is lost, and confirming Create makes a party per filled type).

## Risks

- None require a schema change or touch the closed-file lock from B.
- The trim is deliberately shallow-safe (only recurses into plain objects/arrays), so a field that is genuinely supposed to hold something non-string-shaped (a `Date`, a number) is left alone.
