export interface ResoProperty {
  ListingKey: string;
  StandardStatus?: string;
  ListPrice?: number;
  ClosePrice?: number;
  CloseDate?: string;
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
  StreetDirPrefix?: string;
  StreetDirSuffix?: string;
  UnitNumber?: string;
  City?: string;
  StateOrProvince?: string;
  PostalCode?: string;
  CountyOrParish?: string;
  Latitude?: number;
  Longitude?: number;
  ModificationTimestamp?: string;
  ListingContractDate?: string;
  Media?: { MediaURL: string; Order?: number; MediaClassification?: string }[];
  ListAgentFullName?: string;
  ListOfficeName?: string;
  ListAgentStateLicense?: string;
  // Architecture
  StoriesTotal?: number;
  ArchitecturalStyle?: string;
  NumberOfUnitsTotal?: number;
  Roof?: string;
  GarageSpaces?: number;
  // Features & amenities
  InteriorFeatures?: string;
  ExteriorFeatures?: string;
  FireplaceFeatures?: string;
  FireplacesTotal?: number;
  Flooring?: string;
  LaundryFeatures?: string;
  PatioAndPorchFeatures?: string;
  EntryLevel?: number;
  EntryLocation?: string;
  CommonWalls?: string;
  ParkingFeatures?: string;
  ParkingTotal?: number;
  Cooling?: string;
  Heating?: string;
  PoolPrivateYN?: boolean;
  PoolFeatures?: string;
  SpaFeatures?: string;
  // Property features
  LotFeatures?: string;
  View?: string;
  Directions?: string;
  // Community
  MLSAreaMajor?: string;
  HighSchoolDistrict?: string;
  ElementarySchoolDistrict?: string;
  // HOA & financial
  AssociationFee?: number;
  AssociationFeeFrequency?: string;
  AssociationName?: string;
  ListingTerms?: string;
  LandLeaseYN?: boolean;
  [key: string]: unknown;
}

export function mapResoToProperty(raw: ResoProperty) {
  const streetParts = [
    raw.StreetNumber,
    raw.StreetDirPrefix,
    raw.StreetName,
    raw.StreetSuffix,
    raw.StreetDirSuffix,
  ].filter(Boolean);
  const address = raw.UnitNumber
    ? `${streetParts.join(" ")} #${raw.UnitNumber}`
    : streetParts.join(" ");

  const bathsCalc = raw.BathroomsTotalInteger ?? ((raw.BathroomsFull ?? 0) + (raw.BathroomsHalf ?? 0) * 0.5);
  const baths = bathsCalc || undefined;

  const photos = (raw.Media ?? [])
    .filter((m) => m.MediaClassification == null || m.MediaClassification === "PHOTO")
    .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
    .map((m) => m.MediaURL);

  const propType = (raw.PropertyType ?? "").toLowerCase();
  const listingType = propType.includes("lease") || propType.includes("rent") ? "FOR_RENT" : "FOR_SALE";

  return {
    mlsNumber: raw.ListingKey,
    status: raw.StandardStatus ?? "Unknown",
    listingType,
    listPrice: raw.ListPrice ?? 0,
    closePrice: raw.ClosePrice ?? null,
    closeDate: raw.CloseDate ? new Date(raw.CloseDate) : null,
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
    listAgentName: raw.ListAgentFullName ?? null,
    listAgentLicense: raw.ListAgentStateLicense ?? null,
    listOfficeName: raw.ListOfficeName ?? null,
    details: {
      StoriesTotal: raw.StoriesTotal ?? null,
      ArchitecturalStyle: raw.ArchitecturalStyle ?? null,
      NumberOfUnitsTotal: raw.NumberOfUnitsTotal ?? null,
      Roof: raw.Roof ?? null,
      GarageSpaces: raw.GarageSpaces ?? null,
      PoolPrivateYN: raw.PoolPrivateYN ?? null,
      PoolFeatures: raw.PoolFeatures ?? null,
      SpaFeatures: raw.SpaFeatures ?? null,
      InteriorFeatures: raw.InteriorFeatures ?? null,
      ExteriorFeatures: raw.ExteriorFeatures ?? null,
      Flooring: raw.Flooring ?? null,
      Cooling: raw.Cooling ?? null,
      Heating: raw.Heating ?? null,
      FireplaceFeatures: raw.FireplaceFeatures ?? null,
      LaundryFeatures: raw.LaundryFeatures ?? null,
      ParkingFeatures: raw.ParkingFeatures ?? null,
      ParkingTotal: raw.ParkingTotal ?? null,
      PatioAndPorchFeatures: raw.PatioAndPorchFeatures ?? null,
      EntryLevel: raw.EntryLevel ?? null,
      EntryLocation: raw.EntryLocation ?? null,
      CommonWalls: raw.CommonWalls ?? null,
      LotFeatures: raw.LotFeatures ?? null,
      View: raw.View ?? null,
      Directions: raw.Directions ?? null,
      MLSAreaMajor: raw.MLSAreaMajor ?? null,
      HighSchoolDistrict: raw.HighSchoolDistrict ?? null,
      ElementarySchoolDistrict: raw.ElementarySchoolDistrict ?? null,
      AssociationFee: raw.AssociationFee ?? null,
      AssociationFeeFrequency: raw.AssociationFeeFrequency ?? null,
      AssociationName: raw.AssociationName ?? null,
      ListingTerms: raw.ListingTerms ?? null,
      LandLeaseYN: raw.LandLeaseYN ?? null,
    },
    modifiedAt: raw.ModificationTimestamp ? new Date(raw.ModificationTimestamp) : null,
    listedAt: raw.ListingContractDate ? new Date(raw.ListingContractDate) : null,
  };
}
