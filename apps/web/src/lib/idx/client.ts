import { getResoToken } from "./auth";
import { mapResoToProperty, ResoProperty } from "./field-map";

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

export async function* fetchProperties(modifiedSince?: Date) {
  let token = await getResoToken();
  const filter = buildPropertyFilter(modifiedSince);
  let url: string | null = `${BASE_URL}/Property?${filter}$top=200&$select=${SELECT_FIELDS}&$expand=Media($select=MediaURL,Order)`;
  let retried = false;
  while (url) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 30_000);
    let res: Response;
    try {
      res = await fetch(url, { signal: ac.signal, headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 401 && !retried) {
      retried = true;
      token = await getResoToken();
      continue;
    }
    if (!res.ok) { const text = await res.text(); throw new Error(`RESO fetch failed: ${res.status} ${text}`); }
    const data = (await res.json()) as ODataResponse;
    yield (data.value ?? []).map(mapResoToProperty);
    url = data["@odata.nextLink"] ?? null;
    retried = false;
  }
}
