type Payload = { name?: unknown; note?: unknown; from?: unknown; to?: unknown };

const asText = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

// Extra detail for one activity row, read from the payload the API already saves.
export function describeActivity(a: { type: string; payload: unknown }): { detail: string | null; reason: string | null } {
  const p: Payload = a.payload && typeof a.payload === "object" ? (a.payload as Payload) : {};

  if (a.type === "DOCUMENT_UPLOADED" || a.type === "DOCUMENT_APPROVED") {
    return { detail: asText(p.name), reason: null };
  }
  if (a.type === "DOCUMENT_REJECTED") {
    return { detail: asText(p.name), reason: asText(p.note) };
  }
  if (a.type === "STATUS_CHANGED") {
    const from = asText(p.from);
    const to = asText(p.to);
    if (from && to) return { detail: `${from} → ${to}`, reason: null };
    if (to) return { detail: `→ ${to}`, reason: null };
  }
  return { detail: null, reason: null };
}
