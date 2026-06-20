export const ALL_ACTIVITY_TYPES = ["NOTE", "CALL", "EMAIL", "SHOWING", "OFFER", "DOCUMENT"] as const;

/**
 * Builds a Prisma date filter for a reporting range. Returns `{ gte: Date }`
 * for bounded ranges, or `{}` (no filter) for "all". Unknown/missing ranges
 * default to the current calendar month.
 */
export function getDateFilter(range: string | null): { gte: Date } | {} {
  const now = new Date();
  switch (range) {
    case "week": {
      const d = new Date(now);
      const day = d.getDay(); // 0 = Sunday
      const diff = day === 0 ? 6 : day - 1; // days since Monday
      d.setDate(d.getDate() - diff);
      d.setHours(0, 0, 0, 0);
      return { gte: d };
    }
    case "30d":
      return { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    case "90d":
      return { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
    case "year":
      return { gte: new Date(now.getFullYear(), 0, 1) };
    case "all":
      return {};
    case "month":
    default:
      return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  }
}

/** Formats an average speed-to-lead in hours as a compact label (e.g. "2h 15m", "3d 4h"). */
export function formatSpeedToLead(avgHours: number | null): string {
  if (avgHours === null) return "—";
  if (avgHours < 1) return "< 1h";
  if (avgHours < 24) {
    const h = Math.floor(avgHours);
    const m = Math.round((avgHours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(avgHours / 24);
  const h = Math.floor(avgHours % 24);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}
