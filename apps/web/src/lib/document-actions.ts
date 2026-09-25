// Client calls for the two document actions, shared by the agent Checklist,
// the admin Checklist card, and the admin Documents tab. Each returns null on
// success or a message to show.

async function errorFrom(res: Response, fallback: string): Promise<string | null> {
  if (res.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.error ?? fallback;
}

// Takes the document off its checklist item; it stays in the file.
export async function removeFromChecklist(documentId: string): Promise<string | null> {
  const res = await fetch(`/api/documents/${documentId}/remove`, { method: "POST" });
  return errorFrom(res, "Couldn't remove this document. Please try again.");
}

// Broker only: erases the document for good, logged with the reason.
export async function deleteDocumentPermanently(documentId: string, reason: string): Promise<string | null> {
  const res = await fetch(`/api/documents/${documentId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  return errorFrom(res, "Couldn't delete this document. Please try again.");
}
