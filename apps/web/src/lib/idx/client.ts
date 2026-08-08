import { getResoToken } from "./auth";
import { mapResoToProperty, ResoProperty } from "./field-map";
import { withRetry } from "./retry";

const BASE_URL = "https://api-trestle.corelogic.com/trestle/odata";
const SELECT_FIELDS = [
  // Core listing fields
  "ListingKey", "StandardStatus", "ListPrice", "ClosePrice", "CloseDate",
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

export function buildPropertyFilter(modifiedSince?: Date | string): string {
  const clauses = [STATUS_FILTER];
  if (modifiedSince) {
    const iso = typeof modifiedSince === "string" ? modifiedSince : modifiedSince.toISOString();
    clauses.push(`ModificationTimestamp gt ${iso}`);
  }
  return `$filter=${clauses.join(" and ")}&`;
}

function isTimestamp(value: string | undefined): value is string {
  return !!value && !Number.isNaN(Date.parse(value));
}

// The cursor is the ModificationTimestamp of the last record on a page. It is
// read from the raw RESO record, not the mapped one, so a record that fails to
// map still advances the crawl instead of stalling it.
function lastTimestamp(records: ResoProperty[]): string | undefined {
  for (let i = records.length - 1; i >= 0; i--) {
    const ts = (records[i] as { ModificationTimestamp?: string }).ModificationTimestamp;
    if (isTimestamp(ts)) return ts;
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

// Keyset pagination, NOT @odata.nextLink.
//
// Trestle builds nextLink with $skip, and rejects any request where
// $skip + $top reaches 1,000,000 ("$skip and $top need to be less than
// 1000000"). Since the full feed is ~4.86M records, following nextLink caps a
// crawl at roughly the first million and then hard-fails with a 400.
//
// Instead we order by ModificationTimestamp and ask for everything strictly
// after the last record we saw. No offset is ever sent, so there is no ceiling,
// and the cursor is a plain timestamp that survives a process restart.
//
// startCursor resumes an in-progress crawl — see SyncProgress. It supersedes
// modifiedSince. A cursor that isn't a timestamp (e.g. a checkpoint written by
// the old nextLink-based crawl) is ignored so the crawl restarts cleanly.
export async function* fetchProperties(modifiedSince?: Date, startCursor?: string) {
  const tokenBox = { value: await getResoToken() };
  let cursor: string | undefined = isTimestamp(startCursor)
    ? startCursor
    : modifiedSince?.toISOString();

  for (;;) {
    const url =
      `${BASE_URL}/Property?${buildPropertyFilter(cursor)}` +
      `$orderby=ModificationTimestamp&$top=${PAGE_SIZE}&$select=${SELECT_FIELDS}` +
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

    const next = lastTimestamp(records);
    if (!next) {
      // Without a usable timestamp the cursor cannot advance and the crawl
      // would request this same page forever. Fail loudly instead.
      throw new Error(
        `RESO page of ${records.length} records had no usable ModificationTimestamp; cannot advance cursor`
      );
    }

    yield { properties: mapped, cursor: next };
    cursor = next;
  }
}
