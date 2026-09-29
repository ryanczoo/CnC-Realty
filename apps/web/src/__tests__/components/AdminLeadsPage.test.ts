import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

vi.mock("@/lib/server-utils", () => ({ requireAdminPage: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findMany: vi.fn(), count: vi.fn() },
    agent: { findMany: vi.fn() },
  },
}));
vi.mock("../../app/(dashboard)/admin/leads/AdminLeadsClient", () => ({
  AdminLeadsClient: () => null,
}));

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminLeadsPage from "../../app/(dashboard)/admin/leads/page";
import { AdminLeadsClient } from "../../app/(dashboard)/admin/leads/AdminLeadsClient";

// Walk the returned element tree without rendering it.
function findElement(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findElement(child, type);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  if (node.type === type) return node as ReactElement<Record<string, unknown>>;
  return findElement((node.props as { children?: ReactNode }).children, type);
}

function collectText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join("");
  if (!isValidElement(node)) return "";
  return collectText((node.props as { children?: ReactNode }).children);
}

// The All Leads query is the one that includes the agent relation.
function allLeadsQuery() {
  return vi.mocked(prisma.lead.findMany).mock.calls.find(
    ([args]) => (args as { include?: { agent?: unknown } } | undefined)?.include?.agent
  )?.[0];
}

describe("AdminLeadsPage pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.lead.findMany).mockResolvedValue([]);
    vi.mocked(prisma.agent.findMany).mockResolvedValue([]);
  });

  it("loads the first 100 leads on page 1", async () => {
    vi.mocked(prisma.lead.count).mockResolvedValue(250);

    await AdminLeadsPage({ searchParams: {} });

    expect(allLeadsQuery()).toMatchObject({ skip: 0, take: 100, orderBy: { createdAt: "desc" } });
  });

  it("skips the first 100 leads on page 2", async () => {
    vi.mocked(prisma.lead.count).mockResolvedValue(250);

    await AdminLeadsPage({ searchParams: { page: "2" } });

    expect(allLeadsQuery()).toMatchObject({ skip: 100, take: 100 });
  });

  it("shows the real total, not just the leads on screen", async () => {
    vi.mocked(prisma.lead.count).mockResolvedValue(250);

    const tree = await AdminLeadsPage({ searchParams: {} });

    expect(collectText(tree)).toContain("250 total leads");
  });

  it("hands the page and page count to the table", async () => {
    vi.mocked(prisma.lead.count).mockResolvedValue(250);

    const tree = await AdminLeadsPage({ searchParams: { page: "3" } });
    const client = findElement(tree, AdminLeadsClient);

    expect(client?.props).toMatchObject({ page: 3, totalPages: 3 });
  });

  it("treats a junk page number as page 1", async () => {
    vi.mocked(prisma.lead.count).mockResolvedValue(250);

    await AdminLeadsPage({ searchParams: { page: "abc" } });

    expect(allLeadsQuery()).toMatchObject({ skip: 0 });
  });

  it("sends a page past the end to the last page", async () => {
    vi.mocked(prisma.lead.count).mockResolvedValue(250);

    await expect(AdminLeadsPage({ searchParams: { page: "50" } })).rejects.toThrow(
      "REDIRECT:/admin/leads?page=3"
    );
    expect(redirect).toHaveBeenCalledWith("/admin/leads?page=3");
  });

  it("does not redirect when there are no leads at all", async () => {
    vi.mocked(prisma.lead.count).mockResolvedValue(0);

    const tree = await AdminLeadsPage({ searchParams: { page: "2" } });

    expect(redirect).not.toHaveBeenCalled();
    expect(findElement(tree, AdminLeadsClient)?.props).toMatchObject({ totalPages: 0 });
  });
});
