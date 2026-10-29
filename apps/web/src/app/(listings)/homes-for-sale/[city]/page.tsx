import { notFound } from "next/navigation";
import { SearchResults } from "@/components/properties/SearchResults";
import { SearchUnavailable } from "@/components/properties/SearchUnavailable";
import { loadSearchPage } from "@/lib/property-search-page";
import { cityPageMeta, getCityPages, nearbyCities } from "@/lib/city-pages";
import { DEFAULT_FILTERS } from "@/types/property";

// One page per city with enough homes for sale (lib/city-pages.ts), reached from Google and the sitemap — the
// Search page opened on that city. Rendered on its first visit, then cached for an hour, so a visit costs no query.
export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface PageProps {
  params: { city: string };
}

async function findCity(slug: string) {
  const cities = await getCityPages();
  const city = cities?.find((c) => c.slug === slug);
  return city ? { city, cities: cities! } : null;
}

export async function generateMetadata({ params }: PageProps) {
  const found = await findCity(params.city);
  return found ? cityPageMeta(found.city) : {};
}

export default async function CityHomesPage({ params }: PageProps) {
  const found = await findCity(params.city);
  if (!found) notFound();
  const { city, cities } = found;

  let initial;
  try {
    initial = await loadSearchPage({ query: city.name });
  } catch {
    return <SearchUnavailable />;
  }

  return (
    <>
      <h1 className="sr-only">Homes for Sale in {city.name}, CA</h1>
      <SearchResults
        initialProperties={initial.properties}
        initialTotal={initial.total}
        initialFilters={{ ...DEFAULT_FILTERS, query: city.name }}
        nearby={nearbyCities(city, cities).map((c) => ({ name: c.name, href: `/homes-for-sale/${c.slug}` }))}
      />
    </>
  );
}
