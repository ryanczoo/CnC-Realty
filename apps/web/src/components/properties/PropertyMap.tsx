import dynamic from "next/dynamic";
import { PropertyListing } from "@/types/property";

const PropertyMapInner = dynamic(
  () => import("./PropertyMapInner").then((m) => m.PropertyMapInner),
  { ssr: false, loading: () => <div className="h-full w-full bg-[#1a1a1a]" /> }
);

interface Props {
  properties: PropertyListing[];
  hoveredId: string | null;
}

export function PropertyMap(props: Props) {
  return <PropertyMapInner {...props} />;
}
