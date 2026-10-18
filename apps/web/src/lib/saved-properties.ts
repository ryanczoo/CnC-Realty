// Shared saved-listings cache: every heart on a page reads one React Query entry,
// so saving from any heart updates all of them at once.
export const savedPropertiesKey = (userId: string) => ["saved-properties", userId] as const;

export async function fetchSavedMlsNumbers(): Promise<Set<string>> {
  const res = await fetch("/api/saved-properties");
  if (!res.ok) throw new Error("Failed to load saved properties");
  const data: { mlsNumbers: string[] } = await res.json();
  return new Set(data.mlsNumbers);
}

export function withToggled(saved: Set<string> | undefined, mlsNumber: string): Set<string> {
  const next = new Set(saved);
  if (next.has(mlsNumber)) next.delete(mlsNumber);
  else next.add(mlsNumber);
  return next;
}
