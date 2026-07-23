export function buildPropertySearchParams(raw: string): URLSearchParams {
  const params = new URLSearchParams();

  // Extract "N bed(s)" or "N-bed" → minBeds filter
  const bedMatch = raw.match(/(\d+)\s*-?\s*bed/i);
  if (bedMatch) params.set("minBeds", bedMatch[1]);

  // Extract "in City Name" at end of query → city search
  const cityMatch = raw.match(/\bin\s+([a-zA-Z][a-zA-Z\s]+)$/i);
  if (cityMatch) {
    params.set("query", cityMatch[1].trim());
  } else {
    params.set("query", raw);
  }

  return params;
}
