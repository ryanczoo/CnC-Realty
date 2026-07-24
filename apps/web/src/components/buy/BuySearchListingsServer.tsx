import { headers } from "next/headers";
import { getFeaturedListings } from "@/lib/listings";
import { parseCityHeader, resolveVisitorCity } from "@/lib/visitor-city";
import { BuySearchListings } from "./BuySearchListings";

export async function BuySearchListingsServer() {
  const candidateCity = parseCityHeader(headers().get("x-vercel-ip-city"));
  const { city } = await resolveVisitorCity(candidateCity);
  const listings = await getFeaturedListings(city);
  return <BuySearchListings listings={listings} />;
}
