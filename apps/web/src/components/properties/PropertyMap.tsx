import dynamic from "next/dynamic";
import { PropertyListing } from "@/types/property";

const PropertyMapInner = dynamic(
  () => import("./PropertyMapInner").then((m) => m.PropertyMapInner),
  { ssr: false, loading: () => <div className="h-full w-full bg-[#1a1a1a]" /> }
);

// Phones show this until "Show Map" is tapped. It must have the same React
// shape as PropertyMapInner's server output (a client-only dynamic boundary
// showing the grey loader) — a bare <div> there makes React discard the
// server HTML for the whole search page. Its import never resolves, so it
// downloads nothing.
export const MapPlaceholder = dynamic(() => new Promise<() => null>(() => {}), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#1a1a1a]" />,
});

interface Props {
  properties: PropertyListing[];
  hoveredId: string | null;
  onSelect: (mlsNumber: string) => void;
}

export function PropertyMap(props: Props) {
  return <PropertyMapInner {...props} />;
}
