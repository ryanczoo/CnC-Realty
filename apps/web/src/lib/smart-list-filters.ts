import type { Prisma } from "@cnc/database";

export type FilterCondition =
  | { field: "status";         operator: "is" | "isNot";              value: string[] }
  | { field: "tags";           operator: "hasAnyOf" | "hasNoneOf";    value: string[] }
  | { field: "lastContacted";  operator: "moreThan" | "lessThan";     value: number }
  | { field: "lastContacted";  operator: "never";                     value: null }
  | { field: "timeframe";      operator: "is";                        value: string }
  | { field: "source";         operator: "is" | "isNot";              value: string[] }
  | { field: "priceMin";       operator: "atLeast";                   value: number }
  | { field: "priceMax";       operator: "atMost";                    value: number }
  | { field: "hasPendingTask"; operator: "is";                        value: boolean }
  | { field: "createdDate";    operator: "withinLast" | "moreThan";   value: number };

export const PREBUILT_LISTS: Array<{ slug: string; name: string; filters: FilterCondition[] }> = [
  { slug: "new-this-week",  name: "New This Week",         filters: [{ field: "createdDate",   operator: "withinLast", value: 7 }] },
  { slug: "no-contact-30",  name: "No Contact in 30 Days", filters: [{ field: "lastContacted", operator: "moreThan",   value: 30 }] },
  { slug: "hot-prospects",  name: "Hot Prospects",          filters: [{ field: "status",        operator: "is",         value: ["HOT_PROSPECT"] }] },
  { slug: "nurture",        name: "Nurture",                filters: [{ field: "status",        operator: "is",         value: ["NURTURE"] }] },
  { slug: "sphere",         name: "Sphere",                 filters: [{ field: "status",        operator: "is",         value: ["SPHERE"] }] },
];

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400_000);
}

export function buildLeadWhere(
  filters: FilterCondition[],
  agentId: string | null,
): Prisma.LeadWhereInput {
  // Collect filter conditions (not including agentId)
  const filterConditions: Prisma.LeadWhereInput[] = [];

  for (const f of filters) {
    switch (f.field) {
      case "status":
        filterConditions.push(
          f.operator === "is"
            ? { status: { in: f.value as any } }
            : { status: { notIn: f.value as any } },
        );
        break;
      case "tags":
        filterConditions.push(
          f.operator === "hasAnyOf"
            ? { tags: { some: { tag: { name: { in: f.value } } } } }
            : { tags: { none: { tag: { name: { in: f.value } } } } },
        );
        break;
      case "lastContacted":
        if (f.operator === "moreThan") {
          filterConditions.push({ OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: daysAgo(f.value) } }] });
        } else if (f.operator === "lessThan") {
          filterConditions.push({ lastContactedAt: { gt: daysAgo(f.value), not: null } });
        } else {
          filterConditions.push({ lastContactedAt: null });
        }
        break;
      case "timeframe":
        filterConditions.push({ timeframeToMove: f.value });
        break;
      case "source":
        filterConditions.push(
          f.operator === "is"
            ? { source: { in: f.value as any } }
            : { source: { notIn: f.value as any } },
        );
        break;
      case "priceMin":
        filterConditions.push({ priceMin: { gte: f.value } });
        break;
      case "priceMax":
        filterConditions.push({ priceMax: { lte: f.value } });
        break;
      case "hasPendingTask":
        filterConditions.push(
          f.value
            ? { tasks: { some: { done: false } } }
            : { tasks: { none: { done: false } } },
        );
        break;
      case "createdDate":
        filterConditions.push(
          f.operator === "withinLast"
            ? { createdAt: { gte: daysAgo(f.value) } }
            : { createdAt: { lt: daysAgo(f.value) } },
        );
        break;
    }
  }

  // No agentId and no filters: empty clause
  if (!agentId && filterConditions.length === 0) return {};

  // Only agentId, no filters: return agentId scope directly
  if (agentId && filterConditions.length === 0) return { agentId };

  // Build AND conditions array — agentId clause goes first, then filter conditions
  const andClauses: Prisma.LeadWhereInput[] = [];
  if (agentId) andClauses.push({ agentId });
  andClauses.push(...filterConditions);

  return { AND: andClauses };
}

export function resolveListFilters(
  slug: string | null,
  customLists: Array<{ id: string; filters: unknown }>,
): FilterCondition[] | null {
  if (!slug) return null;
  const prebuilt = PREBUILT_LISTS.find(l => l.slug === slug);
  if (prebuilt) return prebuilt.filters;
  const custom = customLists.find(l => l.id === slug);
  if (custom) return custom.filters as FilterCondition[];
  return null;
}
