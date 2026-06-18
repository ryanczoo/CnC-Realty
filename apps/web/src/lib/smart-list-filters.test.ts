import { describe, it, expect } from "vitest";
import { buildLeadWhere, PREBUILT_LISTS, resolveListFilters } from "./smart-list-filters";

describe("buildLeadWhere", () => {
  it("returns empty object when no filters and no agentId", () => {
    expect(buildLeadWhere([], null)).toEqual({});
  });

  it("scopes to agentId when provided", () => {
    const where = buildLeadWhere([], "agent-1");
    expect(where).toMatchObject({ agentId: "agent-1" });
  });

  it("status is", () => {
    const where = buildLeadWhere([{ field: "status", operator: "is", value: ["HOT_PROSPECT"] }], null);
    expect(where).toMatchObject({ AND: expect.arrayContaining([{ status: { in: ["HOT_PROSPECT"] } }]) });
  });

  it("status isNot", () => {
    const where = buildLeadWhere([{ field: "status", operator: "isNot", value: ["LOST"] }], null);
    expect(where).toMatchObject({ AND: expect.arrayContaining([{ status: { notIn: ["LOST"] } }]) });
  });

  it("tags hasAnyOf", () => {
    const where = buildLeadWhere([{ field: "tags", operator: "hasAnyOf", value: ["Irvine"] }], null);
    expect(where).toMatchObject({ AND: expect.arrayContaining([{ tags: { some: { tag: { name: { in: ["Irvine"] } } } } }]) });
  });

  it("tags hasNoneOf", () => {
    const where = buildLeadWhere([{ field: "tags", operator: "hasNoneOf", value: ["Irvine"] }], null);
    expect(where).toMatchObject({ AND: expect.arrayContaining([{ tags: { none: { tag: { name: { in: ["Irvine"] } } } } }]) });
  });

  it("lastContacted moreThan includes null (never contacted)", () => {
    const where = buildLeadWhere([{ field: "lastContacted", operator: "moreThan", value: 30 }], null) as any;
    const orClause = where.AND.find((c: any) => c.OR);
    expect(orClause).toBeDefined();
    expect(orClause.OR).toEqual(expect.arrayContaining([{ lastContactedAt: null }]));
  });

  it("lastContacted never", () => {
    const where = buildLeadWhere([{ field: "lastContacted", operator: "never", value: null }], null);
    expect(where).toMatchObject({ AND: expect.arrayContaining([{ lastContactedAt: null }]) });
  });

  it("lastContacted lessThan excludes null", () => {
    const where = buildLeadWhere([{ field: "lastContacted", operator: "lessThan", value: 7 }], null) as any;
    const cond = where.AND.find((c: any) => c.lastContactedAt);
    expect(cond.lastContactedAt).toHaveProperty("gt");
    expect(cond.lastContactedAt).toMatchObject({ not: null });
  });

  it("hasPendingTask true", () => {
    const where = buildLeadWhere([{ field: "hasPendingTask", operator: "is", value: true }], null);
    expect(where).toMatchObject({ AND: expect.arrayContaining([{ tasks: { some: { done: false } } }]) });
  });

  it("hasPendingTask false", () => {
    const where = buildLeadWhere([{ field: "hasPendingTask", operator: "is", value: false }], null);
    expect(where).toMatchObject({ AND: expect.arrayContaining([{ tasks: { none: { done: false } } }]) });
  });

  it("priceMin atLeast", () => {
    const where = buildLeadWhere([{ field: "priceMin", operator: "atLeast", value: 500000 }], null);
    expect(where).toMatchObject({ AND: expect.arrayContaining([{ priceMin: { gte: 500000 } }]) });
  });

  it("createdDate withinLast", () => {
    const where = buildLeadWhere([{ field: "createdDate", operator: "withinLast", value: 7 }], null) as any;
    const cond = where.AND.find((c: any) => c.createdAt);
    expect(cond.createdAt).toHaveProperty("gte");
  });

  it("combines multiple filters", () => {
    const where = buildLeadWhere([
      { field: "status", operator: "is", value: ["HOT_PROSPECT"] },
      { field: "tags", operator: "hasAnyOf", value: ["Irvine"] },
    ], "agent-1") as any;
    expect(where.AND).toHaveLength(3); // agentId + status + tags
  });
});

describe("PREBUILT_LISTS", () => {
  it("has 5 lists with unique slugs", () => {
    expect(PREBUILT_LISTS).toHaveLength(5);
    const slugs = PREBUILT_LISTS.map(l => l.slug);
    expect(new Set(slugs).size).toBe(5);
  });

  it("each list has at least one filter", () => {
    for (const list of PREBUILT_LISTS) {
      expect(list.filters.length).toBeGreaterThan(0);
    }
  });
});

describe("resolveListFilters", () => {
  const customLists = [{ id: "cust-1", name: "My List", filters: [{ field: "status", operator: "is", value: ["NEW"] }] }];

  it("returns null for null slug", () => {
    expect(resolveListFilters(null, [])).toBeNull();
  });

  it("returns prebuilt filters for known slug", () => {
    const filters = resolveListFilters("hot-prospects", []);
    expect(filters).not.toBeNull();
    expect(filters![0]).toMatchObject({ field: "status", operator: "is", value: ["HOT_PROSPECT"] });
  });

  it("returns custom list filters for id", () => {
    const filters = resolveListFilters("cust-1", customLists);
    expect(filters).not.toBeNull();
    expect(filters![0]).toMatchObject({ field: "status", operator: "is", value: ["NEW"] });
  });

  it("returns null for unknown slug", () => {
    expect(resolveListFilters("unknown", [])).toBeNull();
  });
});
