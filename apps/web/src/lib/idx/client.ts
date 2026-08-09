import { getResoToken } from "./auth";
import { mapResoToProperty, ResoProperty } from "./field-map";
import { withRetry } from "./retry";

const BASE_URL = "https://api-trestle.corelogic.com/trestle/odata";
const SELECT_FIELDS = [
  // Core listing fields
  "ListingKey", "ListingKeyNumeric", "StandardStatus", "ListPrice", "ClosePrice", "CloseDate",
  "BedroomsTotal", "BathroomsTotalInteger", "BathroomsFull", "BathroomsHalf",
  "LivingArea", "LotSizeSquareFeet", "YearBuilt",
  "PropertySubType", "PropertyType", "PublicRemarks",
  "StreetNumber", "StreetName", "StreetSuffix", "StreetDirPrefix", "StreetDirSuffix", "UnitNumber",
  "City", "StateOrProvince", "PostalCode", "CountyOrParish",
  "Latitude", "Longitude", "ModificationTimestamp", "ListingContractDate",
  "ListAgentFullName", "ListOfficeName", "ListAgentStateLicense",
  // Architecture
  "StoriesTotal", "ArchitecturalStyle", "NumberOfUnitsTotal", "Roof", "GarageSpaces",
  // Features & amenities
  "InteriorFeatures", "ExteriorFeatures", "FireplaceFeatures", "FireplacesTotal",
  "Flooring", "LaundryFeatures", "PatioAndPorchFeatures",
  "EntryLevel", "EntryLocation", "CommonWalls",
  "ParkingFeatures", "ParkingTotal",
  "Cooling", "Heating",
  "PoolPrivateYN", "PoolFeatures", "SpaFeatures",
  // Property features
  "LotFeatures", "View", "Directions",
  // Community
  "MLSAreaMajor", "HighSchoolDistrict", "ElementarySchoolDistrict",
  // HOA & financial
  "AssociationFee", "AssociationFeeFrequency", "AssociationName",
  "ListingTerms", "LandLeaseYN",
].join(",");

interface ODataResponse {
  value: ResoProperty[];
  "@odata.nextLink"?: string;
}

const STATUS_FILTER = "StandardStatus in ('Active','ComingSoon','ActiveUnderContract','Closed')";

const PAGE_SIZE = 200;

export function buildPropertyFilter(modifiedSince?: Date | string, afterKey?: string): string {
  const clauses = [STATUS_FILTER];
  if (modifiedSince) {
    const iso = typeof modifiedSince === "string" ? modifiedSince : modifiedSince.toISOString();
    clauses.push(`ModificationTimestamp gt ${iso}`);
  }
  if (afterKey) clauses.push(`ListingKeyNumeric gt ${afterKey}`);
  return `$filter=${clauses.join(" and ")}&`;
}

// A cursor is only ever a ListingKeyNumeric. Anything else is a checkpoint left
// by an earlier pagination scheme (a timestamp, or a $skip URL) and is ignored
// so the crawl restarts cleanly instead of building a nonsense filter.
export function isKeyCursor(value: string | undefined | null): value is string {
  return !!value && /^\d+$/.test(value);
}

// The cursor is the ListingKeyNumeric of the last record on a page. It is read
// from the raw RESO record, not the mapped one, so a record that fails to map
// still advances the crawl instead of stalling it.
function lastKey(records: ResoProperty[]): string | undefined {
  for (let i = records.length - 1; i >= 0; i--) {
    const key = (records[i] as { ListingKeyNumeric?: number | string }).ListingKeyNumeric;
    if (key !== undefined && key !== null && /^\d+$/.test(String(key))) return String(key);
  }
  return undefined;
}

// Thrown for HTTP failures that a retry cannot fix (bad query, malformed request, etc.)
// — as opposed to transient failures (network errors, timeouts, 5xx, a stale token),
// which are worth retrying since a multi-hour crawl will likely hit at least one.
class PermanentSyncError extends Error {}

async function fetchPage(url: string, tokenBox: { value: string }): Promise<ODataResponse> {
  return withRetry(
    async () => {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 30_000);
      let res: Response;
      try {
        res = await fetch(url, {
          signal: ac.signal,
          headers: { Authorization: `Bearer ${tokenBox.value}`, Accept: "application/json" },
        });
      } finally {
        clearTimeout(timer);
      }
      if (res.status === 401) {
        tokenBox.value = await getResoToken();
        throw new Error("401 Unauthorized — token refreshed, retrying");
      }
      if (!res.ok) {
        const text = await res.text();
        if (res.status < 500) throw new PermanentSyncError(`RESO fetch failed: ${res.status} ${text}`);
        throw new Error(`RESO fetch failed: ${res.status} ${text}`);
      }
      return (await res.json()) as ODataResponse;
    },
    { shouldRetry: (err) => !(err instanceof PermanentSyncError) }
  );
}

// Keyset pagination on ListingKeyNumeric — NOT @odata.nextLink, and NOT
// ModificationTimestamp.
//
// Two things rule out the obvious approaches:
//
// 1. Trestle builds nextLink with $skip and rejects any request where
//    $skip + $top reaches 1,000,000. The feed is ~4.86M records, so following
//    nextLink caps a crawl at the first million and then 400s.
//
// 2. ModificationTimestamp is NOT unique. Measured against the live feed, a
//    200-record page held only 51 distinct timestamps, and 793 records shared
//    a single one. A `ModificationTimestamp gt <last seen>` cursor therefore
//    skips every tied record beyond the current page — silently. That cost a
//    full crawl, which reported success at 43.7% coverage.
//
// ListingKeyNumeric is the integer primary key, so it is unique by definition:
// ties are impossible and no record can be stepped over. It is numeric, so
// ordering has none of the pitfalls of comparing keys as strings.
//
// modifiedSince stays a *filter* (delta syncs still ask for recently-changed
// records); paging within that filter is by key. startCursor resumes an
// in-progress crawl — see SyncProgress.
export async function* fetchProperties(modifiedSince?: Date, startCursor?: string) {
  const tokenBox = { value: await getResoToken() };
  let cursor: string | undefined = isKeyCursor(startCursor) ? startCursor : undefined;

  for (;;) {
    const url =
      `${BASE_URL}/Property?${buildPropertyFilter(modifiedSince, cursor)}` +
      `$orderby=ListingKeyNumeric&$top=${PAGE_SIZE}&$select=${SELECT_FIELDS}` +
      `&$expand=Media($select=MediaURL,Order,MediaClassification)`;

    const data = await fetchPage(url, tokenBox);
    const records = data.value ?? [];
    if (records.length === 0) return;

    const mapped: ReturnType<typeof mapResoToProperty>[] = [];
    for (const raw of records) {
      try {
        mapped.push(mapResoToProperty(raw));
      } catch (err) {
        console.error("Failed to map property", (raw as { ListingKey?: string })?.ListingKey, err);
      }
    }

    const next = lastKey(records);
    if (!next) {
      // Without a usable key the cursor cannot advance and the crawl would
      // request this same page forever. Fail loudly instead.
      throw new Error(
        `RESO page of ${records.length} records had no usable ListingKeyNumeric; cannot advance cursor`
      );
    }

    yield { properties: mapped, cursor: next };
    cursor = next;
  }
}
