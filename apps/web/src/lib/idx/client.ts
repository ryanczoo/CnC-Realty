import { getResoToken } from "./auth";
import { mapResoToProperty, ResoProperty } from "./field-map";

const BASE_URL = "https://api-trestle.corelogic.com/trestle/odata";
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
  let token = await getResoToken();
  const filter = modifiedSince ? `$filter=ModificationTimestamp gt ${modifiedSince.toISOString()}&` : "";
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
