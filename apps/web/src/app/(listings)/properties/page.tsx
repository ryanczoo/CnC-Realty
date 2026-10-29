import { pageMeta } from "@/lib/seo";
import { SearchResults } from "@/components/properties/SearchResults";
import { SearchUnavailable } from "@/components/properties/SearchUnavailable";
import { loadSearchPage, type SearchPageParams } from "@/lib/property-search-page";

export const metadata = pageMeta("/properties");

interface PageProps {
  searchParams: SearchPageParams;
}

export default async function PropertiesPage({ searchParams }: PageProps) {
  try {
    const { properties, total } = await loadSearchPage(searchParams);

    return (
      <>
        <h1 className="sr-only">Homes for Sale in California</h1>
        <SearchResults
          initialProperties={properties}
          initialTotal={total}
        />
      </>
    );
  } catch {
    return <SearchUnavailable />;
  }

}
