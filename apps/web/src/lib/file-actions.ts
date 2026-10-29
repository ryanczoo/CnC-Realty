// Client calls for the Overview pencils: save detail fields on a listing or
// transaction. Return null on success or a message to show in the row. Same
// shape as lib/document-actions.
export async function saveFileFields(
  fileType: "listing" | "transaction",
  id: string,
  data: Record<string, string>,
): Promise<string | null> {
  const res = await fetch(`/api/${fileType === "listing" ? "listings" : "transactions"}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (res.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.error ?? "Couldn't save this change. Please try again.";
}

export function saveFileField(fileType: "listing" | "transaction", id: string, field: string, value: string): Promise<string | null> {
  return saveFileFields(fileType, id, { [field]: value });
}

// Admin only: switch a transaction file to another side of its own family
// (Purchase / Listing / Dual, or the lease sides). Null on success, else the
// server's message — same contract as saveFileField.
export async function changeRepresentation(fileId: string, transactionSide: string): Promise<string | null> {
  const res = await fetch(`/api/transactions/${fileId}/representation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactionSide }),
  });
  if (res.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.error ?? "Couldn't save this change. Please try again.";
}
