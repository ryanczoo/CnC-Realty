# IDX Sync Status Filter Design

## Context

`fetchProperties` in `apps/web/src/lib/idx/client.ts` has no status filter
today — the only `$filter` clause is `ModificationTimestamp gt X` for delta
syncs, and a full sync has no filter at all beyond pagination. This means
every sync (delta or full) pulls whatever statuses CRMLS reports, unscoped.

Ryan confirmed CnC recruits agents statewide across California, so there is
**no geographic filter** — this is purely a status-scoping change.

Verified this session: our current DB (185,017 rows) is already 100% split
across `Active` (70.5%), `Pending` (13.3%), `Closed` (9.2%),
`ActiveUnderContract` (6.3%), `ComingSoon` (0.7%) — zero
`Expired`/`Withdrawn`/`Cancelled` rows exist today, and grepping the
codebase confirms nothing reads those statuses (all matches for those words
belong to the unrelated internal CRM `ListingStatus`/`TransactionFileStatus`
enums, not synced MLS data). Excluding them explicitly going forward is a
correctness/defensive move, not a measured space-saver against current data.

## Scope

**Keep**, for both `FOR_SALE` and `FOR_RENT` listing types: `Active`,
`ComingSoon`, `ActiveUnderContract`. The live property/rent search
(`apps/web/src/app/api/properties/route.ts`) filters on exactly these three
statuses regardless of `listingType`, so both need to stay populated.

**Keep**, for `FOR_SALE` only: `Closed`. Verified via existing test coverage
(`"only matches FOR_SALE listings, excluding closed rentals from comps"`)
that closed rentals are never queried by comps or market snapshot — nothing
in the app uses closed lease records today.

**Drop entirely**: `Expired`, `Withdrawn`, `Cancelled`, and any other
`StandardStatus` value CRMLS might report (e.g. `Pending` is currently
present in our DB but not read by any query — out of scope for this change;
leaving it in the CRMLS-side filter is harmless since nothing consumes it,
and removing it isn't necessary to solve the storage/scope problem this spec
addresses).

## Design

CRMLS's OData `$filter` has no concept of our own `listingType` — that field
is derived locally in `field-map.ts` from `PropertyType`/`PropertySubType`
*after* the record is fetched. So the split (`Closed` kept for `FOR_SALE`
but not `FOR_RENT`) can't be expressed server-side in one filter clause. Two
steps:

**1. CRMLS-side `$filter`** (in `client.ts`, `fetchProperties`): request
only the four statuses that matter at all —
`StandardStatus in ('Active','ComingSoon','ActiveUnderContract','Closed')`
— combined with the existing `ModificationTimestamp gt X` clause via `and`
for delta syncs. This is what actually shrinks what CRMLS sends us.

**2. Post-mapping skip** (in the sync route's upsert loop,
`apps/web/src/app/api/idx/sync/route.ts`): after `mapResoToProperty` runs,
skip the upsert entirely if `status === "Closed" && listingType ===
"FOR_RENT"`. This is the only case CRMLS's status filter can't distinguish
on its own (a closed sale and a closed lease both report `StandardStatus:
"Closed"` — only our own derived `listingType` tells them apart).

## Files touched (implementation, not part of this design doc)

- `apps/web/src/lib/idx/client.ts` — add the `$filter` clause to
  `fetchProperties`.
- `apps/web/src/app/api/idx/sync/route.ts` — add the post-mapping skip
  check before the `prisma.property.upsert` call.

## Testing

Pure filter-string construction gets a unit test (given `modifiedSince`
present/absent, assert the resulting `$filter` string). The skip-logic gets
a unit test on the sync route's upsert loop (mock `fetchProperties` to
yield a closed-rental record and assert `prisma.property.upsert` is never
called for it), following the existing mocking pattern in
`apps/web/src/__tests__/api/` for route handlers.
