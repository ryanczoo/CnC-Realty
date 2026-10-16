// The CRMLS "Last updated" time, always in Pacific: the listing page renders it
// on the server (UTC on Vercel) and the drawer in the visitor's browser, and
// both should read the same. Kept free of server imports for the drawer.
export function formatCrmlsUpdated(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
