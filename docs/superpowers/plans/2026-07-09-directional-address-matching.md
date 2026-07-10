# Directional Address Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the home-value estimator's address lookup correctly find properties whose real address has a directional prefix/suffix (N/S/E/W/NE/NW/SE/SW), which today's address matching cannot handle because we never fetch or store that data from CRMLS.

**Architecture:** Two independent layers, matching the spec: (1) the IDX sync pipeline starts requesting and storing `StreetDirPrefix`/`StreetDirSuffix` as part of the existing `address` string field, and (2) `findSubjectProperty`'s fallback chain gets one new pass that translates a detected directional word to its USPS abbreviation (not drop it — a directional sits mid-string, unlike the trailing suffix the existing fallback already handles by dropping).

**Tech Stack:** TypeScript, Prisma, Vitest. No schema migration, no new dependencies.

## Global Constraints

- No new Prisma schema fields or migrations — directional data folds into the existing `address` string column only.
- Follow TDD: write the failing test first, watch it fail, then implement.
- Match existing test conventions exactly (see Task 1/2 — both existing test files already establish the mocking style to reuse).

---

### Task 1: IDX sync — request and store directional fields

**Files:**
- Modify: `apps/web/src/lib/idx/client.ts` (SELECT_FIELDS array, line 5-31)
- Modify: `apps/web/src/lib/idx/field-map.ts` (ResoProperty interface line 1-19ish, and `mapResoToProperty` address construction line 74-78)
- Test: `apps/web/src/__tests__/lib/field-map.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `ResoProperty.StreetDirPrefix?: string` and `ResoProperty.StreetDirSuffix?: string` fields; `mapResoToProperty()`'s returned `address` string now includes the directional when present, in USPS order `{Number} {DirPrefix} {StreetName} {Suffix} {DirSuffix}`. Task 2 does not depend on this task's output at the type level (it only manipulates search-input strings), but relies on it being shipped for the fix to work end-to-end against real synced data.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/__tests__/lib/field-map.test.ts` (after the existing `describe("mapResoToProperty — ClosePrice/CloseDate", ...)` block, before the final closing — i.e. append as a new top-level `describe`):

```ts
describe("mapResoToProperty — directional prefix/suffix in address", () => {
  it("includes StreetDirPrefix in the address, right after the street number", () => {
    const result = mapResoToProperty({ ...baseRaw(), StreetDirPrefix: "N" } as any);
    expect(result.address).toBe("123 N Main St");
  });

  it("includes StreetDirSuffix in the address, after the street suffix", () => {
    const result = mapResoToProperty({ ...baseRaw(), StreetDirSuffix: "NE" } as any);
    expect(result.address).toBe("123 Main St NE");
  });

  it("includes both a directional prefix and suffix together", () => {
    const result = mapResoToProperty({
      ...baseRaw(),
      StreetDirPrefix: "N",
      StreetDirSuffix: "NE",
    } as any);
    expect(result.address).toBe("123 N Main St NE");
  });

  it("omits directional words entirely when the RESO data has none (existing behavior unchanged)", () => {
    const result = mapResoToProperty(baseRaw() as any);
    expect(result.address).toBe("123 Main St");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/web && pnpm exec vitest run src/__tests__/lib/field-map.test.ts`

Expected: the first 3 new tests FAIL — actual `address` will be `"123 Main St"` in all three cases (missing the directional), because `StreetDirPrefix`/`StreetDirSuffix` aren't read yet. The 4th test (no directionals) already passes — that's fine, it's a regression guard, not new behavior.

- [ ] **Step 3: Add the fields to the RESO field selection**

In `apps/web/src/lib/idx/client.ts`, modify the `SELECT_FIELDS` array (around line 11):

```ts
  "StreetNumber", "StreetName", "StreetSuffix", "StreetDirPrefix", "StreetDirSuffix", "UnitNumber",
```
(replacing the existing line `"StreetNumber", "StreetName", "StreetSuffix", "UnitNumber",`)

- [ ] **Step 4: Add the fields to the ResoProperty interface**

In `apps/web/src/lib/idx/field-map.ts`, modify the interface (around line 19):

```ts
  StreetSuffix?: string;
  StreetDirPrefix?: string;
  StreetDirSuffix?: string;
  UnitNumber?: string;
```
(inserting the two new lines after the existing `StreetSuffix?: string;` line)

- [ ] **Step 5: Update the address construction**

In `apps/web/src/lib/idx/field-map.ts`, modify `mapResoToProperty` (around line 75):

```ts
  const streetParts = [
    raw.StreetNumber,
    raw.StreetDirPrefix,
    raw.StreetName,
    raw.StreetSuffix,
    raw.StreetDirSuffix,
  ].filter(Boolean);
```
(replacing the existing line `const streetParts = [raw.StreetNumber, raw.StreetName, raw.StreetSuffix].filter(Boolean);`)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd apps/web && pnpm exec vitest run src/__tests__/lib/field-map.test.ts`

Expected: all tests PASS, including the 3 new ones and the pre-existing `ClosePrice/CloseDate` block.

- [ ] **Step 7: Run the full suite and typecheck to confirm no regressions**

Run: `cd apps/web && pnpm exec vitest run && pnpm exec tsc --noEmit`

Expected: all tests pass (275+ total); no new TypeScript errors introduced in `client.ts` or `field-map.ts` (pre-existing unrelated errors elsewhere are expected and fine — cross-check any errors against files this task touched).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/idx/client.ts apps/web/src/lib/idx/field-map.ts apps/web/src/__tests__/lib/field-map.test.ts
git commit -m "feat: sync StreetDirPrefix/StreetDirSuffix from CRMLS into address"
```

---

### Task 2: `findSubjectProperty` — directional fallback pass

**Files:**
- Modify: `apps/web/src/lib/home-value-estimate.ts` (`findSubjectProperty`, currently lines 78-108)
- Test: `apps/web/src/__tests__/lib/home-value-estimate.test.ts`

**Interfaces:**
- Consumes: nothing new — `findSubjectProperty(prisma: PrismaClient, address: string, zip: string): Promise<SubjectRecord[]>` keeps its existing signature.
- Produces: same signature, now with a third fallback pass. No other file calls into new exports from this task.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/__tests__/lib/home-value-estimate.test.ts`, inside the existing `describe("findSubjectProperty", ...)` block (after the last existing `it(...)`, before the closing `});` of that describe block — i.e. as new sibling tests alongside the suffix-fallback ones already there):

```ts
  it("falls back to a directional-translated match when the geocoder spells out the directional prefix but MLS data abbreviates it", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");
    const fixture = [
      {
        mlsNumber: "ML-DIR-1",
        status: "Closed",
        beds: 3,
        baths: 2,
        sqft: 1600,
        lotSize: null,
        listPrice: null,
        closePrice: 900000,
        closeDate: new Date("2025-03-01"),
        listedAt: new Date("2024-10-01"),
      },
    ];

    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([]) // strict "1600 North Highland Avenue" — no match
      .mockResolvedValueOnce([]) // suffix-dropped "1600 North Highland" — no match, "North" still unresolved
      .mockResolvedValueOnce(fixture as any); // directional-translated "1600 N Highland" — matches

    const result = await findSubjectProperty(prisma as any, "1600 North Highland Avenue", "90028");

    expect(prisma.property.findMany).toHaveBeenCalledTimes(3);
    const directionalCall = vi.mocked(prisma.property.findMany).mock.calls[2][0] as any;
    expect(directionalCall.where.zip).toBe("90028");
    expect(directionalCall.where.address.contains).toBe("1600 N Highland");
    expect(result).toEqual(fixture);
  });

  it("translates other directional words too, not just North", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");
    const fixture = [{ mlsNumber: "ML-DIR-2" }];

    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(fixture as any);

    await findSubjectProperty(prisma as any, "500 Northeast Elm Drive", "97201");

    const directionalCall = vi.mocked(prisma.property.findMany).mock.calls[2][0] as any;
    expect(directionalCall.where.address.contains).toBe("500 NE Elm");
  });

  it("does not attempt a third query when no directional word is present", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { findSubjectProperty } = await import("@/lib/home-value-estimate");

    vi.mocked(prisma.property.findMany)
      .mockResolvedValueOnce([]) // strict — no match
      .mockResolvedValueOnce([]); // suffix-dropped — no match, and no directional to try

    const result = await findSubjectProperty(prisma as any, "123 Main Street", "91101");

    expect(prisma.property.findMany).toHaveBeenCalledTimes(2);
    expect(result).toEqual([]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/web && pnpm exec vitest run src/__tests__/lib/home-value-estimate.test.ts`

Expected: the 2 new "falls back"/"translates" tests FAIL (only 2 calls happen today, not 3 — there's no third pass yet). The "does not attempt a third query" test currently PASSES already (there's no third pass to accidentally trigger) — that's fine, it's a forward-looking regression guard.

- [ ] **Step 3: Implement the directional fallback pass**

In `apps/web/src/lib/home-value-estimate.ts`, add this constant above `findSubjectProperty` (after the `SUBJECT_SELECT` constant, before the function, i.e. after current line 76):

```ts
const DIRECTIONALS: Record<string, string> = {
  north: "N",
  south: "S",
  east: "E",
  west: "W",
  northeast: "NE",
  northwest: "NW",
  southeast: "SE",
  southwest: "SW",
};
```

Then replace the entire `findSubjectProperty` function (current lines 78-108) with:

```ts
export async function findSubjectProperty(
  prisma: PrismaClient,
  address: string,
  zip: string
): Promise<SubjectRecord[]> {
  const strict = await prisma.property.findMany({
    where: {
      zip,
      address: { contains: address, mode: "insensitive" },
    },
    orderBy: { listedAt: "desc" },
    select: SUBJECT_SELECT,
  });
  if (strict.length > 0) return strict;

  // Geocoders spell street types out in full (e.g. "Circle") while MLS data
  // uses USPS abbreviations (e.g. "Cir") — retry without the trailing word so
  // "15595 Curtis Circle" still matches a stored "15595 Curtis Cir".
  const words = address.trim().split(/\s+/);
  if (words.length < 2) return [];
  const withoutSuffix = words.slice(0, -1).join(" ");

  const suffixDropped = await prisma.property.findMany({
    where: {
      zip,
      address: { contains: withoutSuffix, mode: "insensitive" },
    },
    orderBy: { listedAt: "desc" },
    select: SUBJECT_SELECT,
  });
  if (suffixDropped.length > 0) return suffixDropped;

  // Geocoders also spell directionals out in full (e.g. "North") while MLS
  // data abbreviates them (e.g. "N"). Unlike the suffix, a directional sits
  // mid-string (right after the house number), so it must be translated to
  // its abbreviation rather than dropped — dropping it wouldn't realign with
  // the abbreviated form still present in the stored address.
  const directional = DIRECTIONALS[words[1]?.toLowerCase()];
  if (!directional) return [];
  const withDirectionalAbbreviated = [words[0], directional, ...words.slice(2, -1)].join(" ");

  return prisma.property.findMany({
    where: {
      zip,
      address: { contains: withDirectionalAbbreviated, mode: "insensitive" },
    },
    orderBy: { listedAt: "desc" },
    select: SUBJECT_SELECT,
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/web && pnpm exec vitest run src/__tests__/lib/home-value-estimate.test.ts`

Expected: all tests in this file PASS, including the 3 new ones and every pre-existing test (`computeEstimate`, `percentile`, the existing `findSubjectProperty` suffix tests, `findComps`, `getMarketSnapshot`).

- [ ] **Step 5: Run the full suite and typecheck to confirm no regressions**

Run: `cd apps/web && pnpm exec vitest run && pnpm exec tsc --noEmit`

Expected: all tests pass; no new TypeScript errors in `home-value-estimate.ts`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/home-value-estimate.ts apps/web/src/__tests__/lib/home-value-estimate.test.ts
git commit -m "feat: translate directional prefix/suffix in home-value address matching"
```

---

## Manual Verification (after both tasks)

Once both tasks are committed, confirm end-to-end against real data (dev server + live DB required):

1. Note: existing synced `Property` rows won't have directional data until the next full IDX resync (same operational pattern as every prior field addition — documented in the design spec). This plan's tests fully cover the new logic in isolation; a live end-to-end directional-address test isn't possible until after that resync runs.
2. In the meantime, confirm no regression: retest `15595 Curtis Cir` on `/sell` (the suffix-only case from the prior session) still resolves correctly.
