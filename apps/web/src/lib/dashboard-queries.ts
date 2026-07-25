export async function fetchListings(): Promise<any[]> {
  const res = await fetch("/api/listings");
  if (!res.ok) throw new Error("Failed to load listings");
  const data = await res.json();
  return data.listings ?? [];
}

export async function fetchTransactions(): Promise<any[]> {
  const res = await fetch("/api/transactions");
  if (!res.ok) throw new Error("Failed to load transactions");
  const data = await res.json();
  return data.transactions ?? [];
}

export async function fetchOpenTasks(): Promise<any[]> {
  const res = await fetch("/api/tasks?done=false");
  if (!res.ok) throw new Error("Failed to load tasks");
  return res.json();
}

export async function fetchCompletedTasks(): Promise<any[]> {
  const res = await fetch("/api/tasks?done=true");
  if (!res.ok) throw new Error("Failed to load completed tasks");
  return res.json();
}

export function removeTaskById<T extends { id: string }>(tasks: T[] | undefined, taskId: string): T[] {
  return (tasks ?? []).filter((t) => t.id !== taskId);
}

export async function fetchDeals(pipeline: string): Promise<any[]> {
  const res = await fetch(`/api/deals?pipeline=${pipeline}`);
  if (!res.ok) throw new Error("Failed to load deals");
  return res.json();
}

export function updateDealInList<T extends { id: string }>(deals: T[] | undefined, updated: T): T[] {
  return (deals ?? []).map((d) => (d.id === updated.id ? updated : d));
}

export function removeDealFromList<T extends { id: string }>(deals: T[] | undefined, dealId: string): T[] {
  return (deals ?? []).filter((d) => d.id !== dealId);
}
