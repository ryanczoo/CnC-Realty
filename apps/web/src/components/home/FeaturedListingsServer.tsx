import { headers } from "next/headers";
import { getFeaturedListings } from "@/lib/listings";
import { parseCityHeader, resolveVisitorCity } from "@/lib/visitor-city";
import { FeaturedListings } from "./FeaturedListings";

export async function FeaturedListingsServer() {
  const candidateCity = parseCityHeader(headers().get("x-vercel-ip-city"));
  const { city } = await resolveVisitorCity(candidateCity);
  const listings = await getFeaturedListings(city);
  return <FeaturedListings listings={listings} />;
}
