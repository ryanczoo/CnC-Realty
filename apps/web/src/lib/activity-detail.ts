import { statusLabel } from "@/components/transactions/StatusBadge";

type Payload = { name?: unknown; note?: unknown; from?: unknown; to?: unknown; automatic?: unknown; viaTransactionId?: unknown; reason?: unknown; checklistItemName?: unknown };

const asText = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

// Extra detail for one activity row, read from the payload the API already saves.
export function describeActivity(a: { type: string; payload: unknown }): { detail: string | null; reason: string | null } {
  const p: Payload = a.payload && typeof a.payload === "object" ? (a.payload as Payload) : {};

  if (a.type === "DOCUMENT_UPLOADED" || a.type === "DOCUMENT_APPROVED") {
    return { detail: asText(p.name), reason: null };
  }
  if (a.type === "DOCUMENT_REJECTED") {
    return { detail: asText(p.name), reason: asText(p.note) };
  }
  if (a.type === "DOCUMENT_REMOVED") {
    const name = asText(p.name);
    const item = asText(p.checklistItemName);
    return { detail: name && item ? `${name} (from ${item})` : name, reason: null };
  }
  if (a.type === "DOCUMENT_DELETED") {
    return { detail: asText(p.name), reason: asText(p.reason) };
  }
  if (a.type === "STATUS_CHANGED") {
    // Same readable names as the status badges and dropdown ("Incomplete", "Canceled").
    const fromCode = asText(p.from);
    const toCode = asText(p.to);
    const from = fromCode ? statusLabel(fromCode) : null;
    const to = toCode ? statusLabel(toCode) : null;
    // Who drove it, when it wasn't a person: the morning status job, or the
    // listing's linked transaction (sync in changeFileStatus).
    const source = p.automatic === true ? " (automatic)" : p.viaTransactionId ? " (via transaction file)" : "";
    if (from && to) return { detail: `${from} → ${to}${source}`, reason: null };
    if (to) return { detail: `→ ${to}`, reason: null };
  }
  return { detail: null, reason: null };
}
