import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { SearchResults } from "@/components/properties/SearchResults";
import { SearchUnavailable } from "@/components/properties/SearchUnavailable";
import { loadSearchPage } from "@/lib/property-search-page";
import { cityPageMeta, getCityPages, nearbyCities } from "@/lib/city-pages";
import { DEFAULT_FILTERS } from "@/types/property";

// One page per city with enough homes for sale (lib/city-pages.ts), reached from Google and the sitemap — the
// Search page opened on that city. The root layout reads the login cookie, so the page itself renders per visit;
// its homes are cached for an hour per city, so visits don't query the database.
const loadCityHomes = unstable_cache((name: string) => loadSearchPage({ query: name }), ["city-page-homes"], {
  revalidate: 3600,
});

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
    initial = await loadCityHomes(city.name);
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
