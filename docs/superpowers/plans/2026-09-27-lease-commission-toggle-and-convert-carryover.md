# Lease Commission %/$ + Convert Carries Commission — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD per task.

**Goal:** Every commission field uses the shared `CommissionField` with its %/$ toggle (Lease Commission was the only $-only one), and converting a listing carries its commission (and notes) into the new transaction.

**Decisions (Ryan, 2026-09-27):** Lease Commission gets % and $ on all three lease sides (residential + commercial), wizard + Overview; a lease % always means % of the **Total Lease Amount**. Convert copies the listing's commission as entered (% stays %, $ stays $) for all four listing types, agent + admin (the one shared convert route and `ConvertListingButton`). Toggle-clear and the 100% cap already live in shared code and apply automatically.

**Mapping on convert:** Residential/Commercial Sale → Listing side → Listing Agent Commission. Residential/Commercial Lease → Lease Landlord → Lease Commission (the sale fields). Sale price / lease amount aren't known yet, so a % has no $ until the price is entered (the existing edit re-pricing fills it in).

**No page-load cost:** all changes are save-time math or render conditions on data already loaded.

## Tasks
1. **Shared math** (TDD, `lib/commission.ts`): `resolveCommission` leaves a %'s $ empty (null, not $0) when there's no price yet; new `convertedCommission(listing, side)` → transaction commission fields + notes via `resolveCommission`.
2. **Convert route** (TDD): spread `convertedCommission` into the created transaction.
3. **Lease %/$ everywhere:**
   - Wizard: commission math uses `resolveCommission` with the side's price (lease → Total Lease Amount); remove the lease `hideModeToggle` and the force-$ effect.
   - Overview: Lease Commission row uses the normal %/$ pencil and shows "5%" or "$15,000"; drop the now-unused `flatOnly` / `hideModeToggle` plumbing (`OverviewTab`, `InfoRow`, `CommissionField`).
   - `commissionChanges`: log a lease % as %.
   - Commission tab: show the lease % row when one is set.
4. Gate (vitest, tsc, lint, dev log), commit; click-through list.
