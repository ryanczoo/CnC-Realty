import { statusLabel } from "@/components/transactions/StatusBadge";
import { transactionSideLabel } from "@/types/transaction";

type Payload = { name?: unknown; note?: unknown; from?: unknown; to?: unknown; automatic?: unknown; viaTransactionId?: unknown; reason?: unknown; checklistItemName?: unknown; changes?: unknown; added?: unknown; removed?: unknown };

const asText = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

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
  if (a.type === "COMMISSION_CHANGED") {
    // One entry per save: each changed commission as "Label: old → new".
    const changes = Array.isArray(p.changes) ? (p.changes as { label?: unknown; from?: unknown; to?: unknown }[]) : [];
    const lines = changes
      .filter((c) => asText(c.label) && asText(c.from) && asText(c.to))
      .map((c) => `${asText(c.label)}: ${asText(c.from)} → ${asText(c.to)}`);
    return { detail: lines.length ? lines.join("; ") : null, reason: null };
  }
  if (a.type === "CHECKLIST_UPDATED") {
    // "Year Built set to 1952 — checklist added: LPD, …; removed: …"
    const parts = [
      list(p.added).length ? `added: ${list(p.added).join(", ")}` : null,
      list(p.removed).length ? `removed: ${list(p.removed).join(", ")}` : null,
    ].filter(Boolean);
    const why = asText(p.reason);
    const changes = parts.length ? `checklist ${parts.join("; ")}` : null;
    return { detail: why && changes ? `${why} — ${changes}` : why ?? changes, reason: null };
  }
  if (a.type === "REPRESENTATION_CHANGED") {
    // "Changed representation from Listing to Both Purchase & Listing — Added: RLA; Removed: …"
    const from = asText(p.from);
    const to = asText(p.to);
    if (!from || !to) return { detail: null, reason: null };
    const parts = [
      list(p.added).length ? `Added: ${list(p.added).join(", ")}` : null,
      list(p.removed).length ? `Removed: ${list(p.removed).join(", ")}` : null,
    ].filter(Boolean);
    const head = `Changed representation from ${transactionSideLabel(from)} to ${transactionSideLabel(to)}`;
    return { detail: parts.length ? `${head} — ${parts.join("; ")}` : head, reason: null };
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
    if (from && to) return { detail: `${from} → ${to}${source}`, reason: asText(p.reason) };
    if (to) return { detail: `→ ${to}`, reason: null };
  }
  return { detail: null, reason: null };
}

// The reason on the most recent cancellation request (STATUS_CHANGED -> Cancel
// Pending), read from activity the file page already loads — shown to the broker
// while the request is pending.
export function latestCancellationReason(
  activities: readonly { type: string; payload: unknown; createdAt: string | Date }[],
): string | null {
  const requests = activities
    .filter((a) => {
      const p = a.payload && typeof a.payload === "object" ? (a.payload as Payload) : {};
      return a.type === "STATUS_CHANGED" && p.to === "CANCELED_PENDING" && !!asText(p.reason);
    })
    .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
  return requests.length ? asText((requests[0].payload as Payload).reason) : null;
}
