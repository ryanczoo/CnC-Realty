export function buildPropertySearchParams(raw: string): URLSearchParams {
  const params = new URLSearchParams();

  // Extract "N bed(s)" or "N-bed" → minBeds filter, then strip it out so it
  // never lingers in the location query text below.
  const bedMatch = raw.match(/(\d+)\s*-?\s*bed/i);
  const withoutBed = bedMatch
    ? raw.slice(0, bedMatch.index) + raw.slice(bedMatch.index! + bedMatch[0].length)
    : raw;
  if (bedMatch) params.set("minBeds", bedMatch[1]);

  // Extract "in City Name" (optionally ", CA") at end of query → city search;
  // the server drops the state when it searches
  const cityMatch = withoutBed.match(/\bin\s+([a-zA-Z][a-zA-Z\s,.]+)$/i);
  if (cityMatch) {
    params.set("query", cityMatch[1].trim());
  } else {
    params.set("query", withoutBed.trim());
  }

  return params;
}
