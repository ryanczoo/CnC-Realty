# Two-Tier Price History Retention Design

## Context

`PriceHistory` (shown on `/home-value`) pulls every past listing record for
the searched address via `findSubjectProperty`, with no date bound —
distinct from Comparable Sales and Local Market Snapshot, which are both
capped at a 1-year window. Ryan decided to keep Price History unbounded
(verified via live screenshots that BHHS, our reference tool, has comps and
market trends but no price history at all — so this is intentionally
something extra CnC offers, not a gap to close).

Since CnC now syncs statewide with no geographic filter, keeping full
records (photos JSON array + details JSON blob — the dominant storage
driver per this session's codebase survey) for *all* historical closed
sales indefinitely would reintroduce the unbounded-storage-growth problem
this whole discussion started from. Measured this session: full records
average ~2,200 bytes/row (photos + details + description) vs. ~200
bytes/row for the scalar fields `PriceHistory` actually renders
(`mlsNumber`, `status`, `listPrice`, `closePrice`, `closeDate`,
`listedAt`) — roughly 11x smaller.

## Design

**Full record** (photos + details JSON, as today): written for any `Active`
listing, or any `Closed` `FOR_SALE` sale with `closeDate` within the
trailing 1 year — i.e. exactly the set Comparable Sales and Local Market
Snapshot already query.

**Lightweight record**: written for `Closed` `FOR_SALE` sales with
`closeDate` older than 1 year. Same row, same `mlsNumber`, all scalar
fields populated normally — `photos` and `details` are written as empty
(`[]` / `null`) instead of the fetched values, since nothing that reads
older records (only `PriceHistory`, via `findSubjectProperty`) uses either
field.

This decision is made **at upsert time**, in the same sync-route loop as
the status filter's skip check (previous spec): compute `isOldClosedSale =
status === "Closed" && closeDate is more than 1 year before now`, and if
true, overwrite `photos`/`details` on the mapped record before calling
`prisma.property.upsert`.

**Known limitation, accepted as out of scope for this change:** this check
only runs when a record is *written* (created or updated by a sync).
Delta syncs only re-touch records CRMLS reports as recently modified
(`ModificationTimestamp gt X`), and a closed sale typically doesn't get
modified again after closing — so a record synced while still within the
1-year window keeps its full photos/details indefinitely once it ages past
that window, unless something else re-touches it. This doesn't reintroduce
the original problem (unbounded statewide history is still avoided, since
the upcoming full resync will correctly lightweight-ify everything already
older than 1 year at sync time), it just means the full-record set has a
slowly-accumulating tail of stale-but-still-full rows rather than being
perfectly pruned. A periodic downgrade sweep could close this gap later if
it turns out to matter; not building it now (YAGNI — no evidence yet that
the aging-tail volume is large enough to care about).

## Files touched (implementation, not part of this design doc)

- `apps/web/src/app/api/idx/sync/route.ts` — add the
  full-vs-lightweight decision to the upsert loop, alongside the
  status-filter skip check from the previous spec.

## Testing

Unit test on the sync route's upsert loop: given a mocked `fetchProperties`
yielding (a) an Active listing, (b) a Closed sale within 1 year, (c) a
Closed sale older than 1 year — assert the `prisma.property.upsert` call's
`create`/`update` payload has full `photos`/`details` for (a) and (b), and
empty `photos`/`details` for (c). Uses `vi.setSystemTime` to fix "now" for
the 1-year boundary calculation, same pattern already used in
`home-value-estimate.test.ts` for the market-snapshot window tests.
