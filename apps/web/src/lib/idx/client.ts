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

export function buildPropertyFilter(modifiedSince?: Date): string {
  const clauses = [STATUS_FILTER];
  if (modifiedSince) {
    clauses.push(`ModificationTimestamp gt ${modifiedSince.toISOString()}`);
  }
  return `$filter=${clauses.join(" and ")}&`;
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

export async function* fetchProperties(modifiedSince?: Date) {
  const tokenBox = { value: await getResoToken() };
  const filter = buildPropertyFilter(modifiedSince);
  let url: string | null = `${BASE_URL}/Property?${filter}$top=200&$select=${SELECT_FIELDS}&$expand=Media($select=MediaURL,Order,MediaClassification)`;
  while (url) {
    const data = await fetchPage(url, tokenBox);
    const mapped: ReturnType<typeof mapResoToProperty>[] = [];
    for (const raw of data.value ?? []) {
      try {
        mapped.push(mapResoToProperty(raw));
      } catch (err) {
        console.error("Failed to map property", (raw as { ListingKey?: string })?.ListingKey, err);
      }
    }
    yield mapped;
    url = data["@odata.nextLink"] ?? null;
  }
}
