import { getFeaturedListings } from "@/lib/listings";
import { FeaturedListings } from "./FeaturedListings";

export async function FeaturedListingsServer() {
  const listings = await getFeaturedListings();
  return <FeaturedListings listings={listings} />;
}
