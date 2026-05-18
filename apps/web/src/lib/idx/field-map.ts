export interface ResoProperty {
  ListingKey: string;
  StandardStatus?: string;
  ListPrice?: number;
  BedroomsTotal?: number;
  BathroomsTotalInteger?: number;
  BathroomsFull?: number;
  BathroomsHalf?: number;
  LivingArea?: number;
  LotSizeSquareFeet?: number;
  YearBuilt?: number;
  PropertySubType?: string;
  PropertyType?: string;
  PublicRemarks?: string;
  StreetNumber?: string;
  StreetName?: string;
  StreetSuffix?: string;
  UnitNumber?: string;
  City?: string;
  StateOrProvince?: string;
  PostalCode?: string;
  CountyOrParish?: string;
  Latitude?: number;
  Longitude?: number;
  ModificationTimestamp?: string;
  ListingContractDate?: string;
  Media?: { MediaURL: string; Order?: number }[];
  [key: string]: unknown;
}

export function mapResoToProperty(raw: ResoProperty) {
  const streetParts = [raw.StreetNumber, raw.StreetName, raw.StreetSuffix].filter(Boolean);
  const address = raw.UnitNumber
    ? `${streetParts.join(" ")} #${raw.UnitNumber}`
    : streetParts.join(" ");

  const bathsCalc = raw.BathroomsTotalInteger ?? ((raw.BathroomsFull ?? 0) + (raw.BathroomsHalf ?? 0) * 0.5);
  const baths = bathsCalc || undefined;

  const photos = (raw.Media ?? [])
    .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
    .map((m) => m.MediaURL);

  const propType = (raw.PropertyType ?? "").toLowerCase();
  const listingType = propType.includes("lease") || propType.includes("rent") ? "FOR_RENT" : "FOR_SALE";

  return {
    mlsNumber: raw.ListingKey,
    status: raw.StandardStatus ?? "Unknown",
    listingType,
    listPrice: raw.ListPrice ?? 0,
    beds: raw.BedroomsTotal ?? null,
    baths: baths ?? null,
    sqft: raw.LivingArea ? Math.round(raw.LivingArea) : null,
    lotSize: raw.LotSizeSquareFeet ? raw.LotSizeSquareFeet / 43560 : null,
    yearBuilt: raw.YearBuilt ?? null,
    propertyType: raw.PropertySubType ?? raw.PropertyType ?? null,
    description: raw.PublicRemarks ?? null,
    address: address || "Unknown",
    city: raw.City ?? "Unknown",
    state: raw.StateOrProvince ?? "CA",
    zip: raw.PostalCode ?? "",
    county: raw.CountyOrParish ?? null,
    latitude: raw.Latitude ?? null,
    longitude: raw.Longitude ?? null,
    photos: photos,
    rawData: raw as object,
    modifiedAt: raw.ModificationTimestamp ? new Date(raw.ModificationTimestamp) : null,
    listedAt: raw.ListingContractDate ? new Date(raw.ListingContractDate) : null,
  };
}
