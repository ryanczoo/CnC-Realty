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
