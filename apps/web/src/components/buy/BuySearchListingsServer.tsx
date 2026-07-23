import { getFeaturedListings } from "@/lib/listings";
import { BuySearchListings } from "./BuySearchListings";

export async function BuySearchListingsServer() {
  const listings = await getFeaturedListings();
  return <BuySearchListings listings={listings} />;
}
