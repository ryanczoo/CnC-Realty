# Home-Value Address Matching — Directional Prefix/Suffix — Design Spec

**Date:** 2026-07-09
**Status:** Approved, ready for implementation plan

---

## Overview

Extends `findSubjectProperty()` (the address-lookup step behind the `/sell` home-value estimator) to correctly match addresses with a directional prefix or suffix (e.g. "N", "S", "NE"), the same way the 2026-07-08 session already fixed the street-suffix-abbreviation mismatch (Circle vs. Cir).

**Root cause:** our stored `Property.address` is built from only `StreetNumber + StreetName + StreetSuffix` — `StreetDirPrefix`/`StreetDirSuffix` are never requested from CRMLS at all, so a directional street's stored address is missing that word entirely. Mapbox, by contrast, always returns the real, complete address — directional spelled out in full ("North," not "N") — confirmed via a live Mapbox query during design (`1600 N Highland Ave` → returned as `"1600 North Highland Avenue"`). Because the user must select a Mapbox suggestion (not type free text into the DB search), this mismatch is guaranteed to surface on every directional-street lookup, not just an occasional typo.

**Why the existing suffix fix's approach doesn't extend directly:** the suffix fix works by dropping the *last* word and retrying `contains` — safe because the suffix sits at the end, so the remaining prefix still lines up character-for-character with the stored value. A directional sits between the house number and street name, in the *middle* of the string. Dropping it doesn't realign anything (the stored value still has the abbreviated directional character sitting in the middle), so it needs to be *translated* to its abbreviated form, not dropped.

**What ships:**
- `StreetDirPrefix`/`StreetDirSuffix` added to the IDX sync's field selection and address construction (USPS order: `{Number} {DirPrefix} {StreetName} {Suffix} {DirSuffix}`)
- One new fallback pass in `findSubjectProperty`: translate a detected directional word (North/South/East/West/Northeast/Northwest/Southeast/Southwest, case-insensitive) to its standard abbreviation, combined with the existing "drop last word" suffix logic, then retry
- Pass is skipped when no directional word is detected, to avoid a redundant duplicate query on the (common) non-directional case

**What is deferred:**
- General fuzzy/typo-tolerant matching (out of scope — Mapbox's own autocomplete already prevents typos from reaching this code, since the user must select a suggestion rather than submit free text)
- Coordinate/lat-lng proximity fallback (considered and rejected during design — real US addressing means a directional variant of the same street name can be a genuinely different, non-adjacent segment; a naive proximity fallback risks silently matching the wrong house. Revisit only if a real, unresolved gap shows up in practice.)
- Homepage hero search bar (`/properties?query=`) — uses a completely different, list-returning, OR-across-city-and-address query with no expectation of a single exact match; the same underlying data gap doesn't produce a broken experience there, so it's out of scope here.

---

## 1. IDX sync — request and store the directional fields

**`apps/web/src/lib/idx/client.ts`** — add to `SELECT_FIELDS`:
```
"StreetDirPrefix", "StreetDirSuffix",
```

**`apps/web/src/lib/idx/field-map.ts`**:
- Add `StreetDirPrefix?: string` and `StreetDirSuffix?: string` to the `ResoProperty` interface.
- Update the address-construction logic to assemble, in USPS order, filtering out missing parts (same `.filter(Boolean)` pattern already used):
  ```
  [StreetNumber, StreetDirPrefix, StreetName, StreetSuffix, StreetDirSuffix]
  ```

No schema migration needed — this only changes what's folded into the existing `address` string column, not a new column.

## 2. `findSubjectProperty` — new fallback pass

**`apps/web/src/lib/home-value-estimate.ts`**

Add a small fixed lookup table (module-level constant):
```ts
const DIRECTIONALS: Record<string, string> = {
  north: "N", south: "S", east: "E", west: "W",
  northeast: "NE", northwest: "NW", southeast: "SE", southwest: "SW",
};
```

After the existing "strict" and "no-suffix" passes both return empty, add a third pass:
1. Split the address into words. The candidate directional word is the one immediately after the house number (`words[1]`).
2. Look it up in `DIRECTIONALS` (case-insensitive). If not found, return `[]` immediately (skip the query — nothing new to try, would just duplicate the already-failed no-suffix pass).
3. If found: replace `words[1]` with its abbreviation, drop the last word (same logic as the existing suffix pass), rejoin, and run the same zip-scoped `contains` query as the other passes.

Worked example: search `"1600 North Highland Avenue"` → directional word `"North"` found → replace with `"N"`, drop last word `"Avenue"` → query string `"1600 N Highland"` → matches stored `"1600 N Highland Ave"` via `contains`. ✓

## 3. Testing

New/extended cases in `apps/web/src/__tests__/lib/home-value-estimate.test.ts`:
- Directional + suffix mismatch resolves correctly (the worked example above).
- A non-directional address with only a suffix mismatch still resolves via the existing pass 2, and does **not** trigger pass 3's query (assert call count) — confirms the skip-when-no-directional-detected guard works.
- At least one additional directional word (e.g. a two-letter ordinal like "Northeast" → "NE") to confirm the lookup table isn't hardcoded to only "North."

## 4. Cost recap (no change from what was discussed)

No new columns, no new indexes — a few extra characters folded into the existing `address` field. One additional sub-millisecond fallback query, only reached when the first two passes both fail and a directional is actually detected.
