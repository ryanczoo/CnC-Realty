import { BedDouble, Bath, Ruler, Calendar, Home, MapPin, type LucideIcon } from "lucide-react";

interface PropertyStats {
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  yearBuilt: number | null;
  county: string | null;
  propertyType: string | null;
}

export function buildStatsFields(
  p: PropertyStats,
): Array<{ icon: LucideIcon; label: string; value: string | number }> {
  const items: Array<{ icon: LucideIcon; label: string; value: string | number | null }> = [
    { icon: BedDouble, label: "Beds",          value: p.beds },
    { icon: Bath,      label: "Baths",         value: p.baths },
    { icon: Ruler,     label: "Sq. Ft.",       value: p.sqft != null ? p.sqft.toLocaleString() : null },
    { icon: Calendar,  label: "Year Built",    value: p.yearBuilt },
    { icon: MapPin,    label: "County",        value: p.county },
    { icon: Home,      label: "Property Type", value: p.propertyType },
  ];
  return items.filter(
    (f): f is { icon: LucideIcon; label: string; value: string | number } => f.value != null,
  );
}

export function buildDetailSections(
  r: Record<string, unknown>,
  lotSize: number | null,
): Array<{ title: string; fields: [string, unknown][] }> {
  const hoaFee = r.AssociationFee as number | undefined;
  const hoaFreq = r.AssociationFeeFrequency as string | undefined;
  const hoaValue =
    hoaFee && hoaFee > 0
      ? hoaFreq
        ? `$${hoaFee.toLocaleString()} / ${hoaFreq}`
        : `$${hoaFee.toLocaleString()}`
      : null;

  return [
    {
      title: "Architecture",
      fields: [
        ["Stories",       r.StoriesTotal],
        ["Style",         r.ArchitecturalStyle],
        ["Total Units",   r.NumberOfUnitsTotal],
        ["Roof",          r.Roof],
        ["Garage Spaces", r.GarageSpaces],
        ["Pool",          r.PoolPrivateYN ? (r.PoolFeatures || "Yes") : null],
        ["Spa",           r.SpaFeatures],
      ],
    },
    {
      title: "Features & Amenities",
      fields: [
        ["Interior Features", r.InteriorFeatures],
        ["Exterior Features", r.ExteriorFeatures],
        ["Flooring",          r.Flooring],
        ["Cooling",           r.Cooling],
        ["Heating",           r.Heating],
        ["Fireplace",         r.FireplaceFeatures],
        ["Laundry",           r.LaundryFeatures],
        ["Parking Features",  r.ParkingFeatures],
        ["Parking Total",     r.ParkingTotal],
        ["Patio & Porch",     r.PatioAndPorchFeatures],
        ["Entry Level",       r.EntryLevel],
        ["Entry Location",    r.EntryLocation],
        ["Common Walls",      r.CommonWalls],
      ],
    },
    {
      title: "Property Features",
      fields: [
        ["Lot Size",    lotSize != null ? `${lotSize.toFixed(2)} ac` : null],
        ["Lot Features", r.LotFeatures],
        ["View",        r.View],
        ["Directions",  r.Directions],
      ],
    },
    {
      title: "Community",
      fields: [
        ["Area",            r.MLSAreaMajor],
        ["School District", (r.HighSchoolDistrict as string) || (r.ElementarySchoolDistrict as string)],
      ],
    },
    {
      title: "Tax & Financial",
      fields: [
        ["Terms",      r.ListingTerms],
        ["Land Lease", r.LandLeaseYN != null ? (r.LandLeaseYN ? "Yes" : "No") : null],
        ["HOA Name",   r.AssociationName],
        ["HOA Fee",    hoaValue],
      ],
    },
  ];
}
