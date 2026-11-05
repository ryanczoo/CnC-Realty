// Marker an admin's Agent-section pages send so the server treats them as an
// agent. Client-safe: no server imports. The marker can only remove rights.
export const AGENT_VIEW_HEADER = "x-cnc-agent-view";

export function withAgentView(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set(AGENT_VIEW_HEADER, "1");
  return { ...init, headers };
}

// Where an admin viewing another agent's file belongs (the Admin section).
// Null when the viewer should stay on the page they are on.
export function adminFilePathFor(
  viewer: { role?: string | null; agentId?: string | null },
  file: { agentId: string },
  fileType: "listing" | "transaction",
  id: string
): string | null {
  if (viewer.role !== "ADMIN" || viewer.agentId === file.agentId) return null;
  return `/admin/transactions/${fileType}/${id}`;
}
