import { getResoToken } from "./auth";
import { mapResoToProperty, ResoProperty } from "./field-map";

const BASE_URL = "https://replication.crmls.org/CRMLS/reso/odata";
const SELECT_FIELDS = [
  "ListingKey", "StandardStatus", "ListPrice",
  "BedroomsTotal", "BathroomsTotalInteger", "BathroomsFull", "BathroomsHalf",
  "LivingArea", "LotSizeSquareFeet", "YearBuilt",
  "PropertySubType", "PropertyType", "PublicRemarks",
  "StreetNumber", "StreetName", "StreetSuffix", "UnitNumber",
  "City", "StateOrProvince", "PostalCode", "CountyOrParish",
  "Latitude", "Longitude", "ModificationTimestamp", "ListingContractDate",
].join(",");

interface ODataResponse {
  value: ResoProperty[];
  "@odata.nextLink"?: string;
}

export async function* fetchProperties(modifiedSince?: Date) {
  const token = await getResoToken();
  const filter = modifiedSince ? `$filter=ModificationTimestamp gt ${modifiedSince.toISOString()}&` : "";
  let url: string | null = `${BASE_URL}/Property?${filter}$top=200&$select=${SELECT_FIELDS}&$expand=Media($select=MediaURL,Order)`;
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!res.ok) { const text = await res.text(); throw new Error(`RESO fetch failed: ${res.status} ${text}`); }
    const data = (await res.json()) as ODataResponse;
    yield data.value.map(mapResoToProperty);
    url = data["@odata.nextLink"] ?? null;
  }
}
