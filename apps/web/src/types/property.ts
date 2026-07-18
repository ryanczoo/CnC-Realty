export interface PropertyListing {
  id: string;
  mlsNumber: string;
  status: string;
  listPrice: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  propertyType: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
  photos: string[];
  listedAt: string | null;
}

export interface SearchFilters {
  query: string;
  listingType: string;
  minPrice: string;
  maxPrice: string;
  minBeds: string;
  minBaths: string;
  propertyType: string;
}

export const MULTIFAMILY_TYPES = ["Duplex", "Triplex", "Quadruplex", "MultiFamily", "Apartment", "ResidentialIncome"] as const;

export const COMMERCIAL_TYPES = [
  "CommercialSale", "CommercialLease", "Office", "Retail", "Industrial",
  "Warehouse", "BusinessOpportunity", "Business", "MixedUse", "SpecialPurpose", "HotelMotel",
] as const;

export function isCommercialPropertyType(propertyType: string | null): boolean {
  return propertyType != null && (COMMERCIAL_TYPES as readonly string[]).includes(propertyType);
}

// Warehouse and Business are real CRMLS PropertySubType values, but too
// narrow to be worth their own filter row — displayed under their broader
// sibling instead (Warehouse -> Industrial, Business -> BusinessOpportunity).
const PROPERTY_TYPE_DISPLAY_OVERRIDES: Record<string, string> = {
  Warehouse: "Industrial",
  Business: "BusinessOpportunity",
};

export function getDisplayPropertyType(propertyType: string): string {
  return PROPERTY_TYPE_DISPLAY_OVERRIDES[propertyType] ?? propertyType;
}

export function formatPropertyStatus(status: string): string {
  if (status === "ComingSoon") return "Coming Soon";
  if (status === "ActiveUnderContract") return "Under Contract";
  return status;
}

export const DEFAULT_FILTERS: SearchFilters = {
  query: "",
  listingType: "FOR_SALE",
  minPrice: "",
  maxPrice: "",
  minBeds: "",
  minBaths: "",
  propertyType: "",
};
