import { SITE_URL } from "@/lib/seo";
import { getCityPages } from "@/lib/city-pages";
import { urlsetXml, XML_RESPONSE_HEADERS } from "@/lib/sitemap";

// The city search pages (/homes-for-sale/<city>), from the daily saved list (lib/city-pages.ts). Its own file because
// the Redis read can't sit inside the other sitemap files' hourly cache; reading one saved key per request is cheap.
export const dynamic = "force-dynamic";

export async function GET() {
  const cities = (await getCityPages()) ?? [];
  const entries = cities.map((c) => ({ loc: `${SITE_URL}/homes-for-sale/${c.slug}` }));
  return new Response(urlsetXml(entries), { headers: XML_RESPONSE_HEADERS });
}
