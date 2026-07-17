import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    checklistTemplate: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/admin/checklist-templates/route";
import { PATCH } from "../../app/api/admin/checklist-templates/[id]/route";

const SESSION_ADMIN = { user: { id: "u1", role: "ADMIN" } };

function makeRequest(body: object) {
  return new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/admin/checklist-templates — propertyCategory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists propertyCategory on create, defaulting to ALL when omitted", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_ADMIN as any);
    vi.mocked(prisma.checklistTemplate.create).mockResolvedValue({ id: "t1" } as any);

    await POST(makeRequest({ name: "Commercial Purchase Forms", fileType: "TRANSACTION", transactionSide: "PURCHASE", propertyCategory: "COMMERCIAL" }));

    expect(prisma.checklistTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ propertyCategory: "COMMERCIAL" }) })
    );
  });

  it("defaults propertyCategory to ALL when not provided", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_ADMIN as any);
    vi.mocked(prisma.checklistTemplate.create).mockResolvedValue({ id: "t2" } as any);

    await POST(makeRequest({ name: "Referral Forms", fileType: "TRANSACTION" }));

    expect(prisma.checklistTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ propertyCategory: "ALL" }) })
    );
  });
});

describe("PATCH /api/admin/checklist-templates/[id] — propertyCategory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates propertyCategory when provided", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_ADMIN as any);
    vi.mocked(prisma.checklistTemplate.update).mockResolvedValue({ id: "t1" } as any);

    const req = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ propertyCategory: "COMMERCIAL" }),
      headers: { "Content-Type": "application/json" },
    });
    await PATCH(req, { params: { id: "t1" } });

    expect(prisma.checklistTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ propertyCategory: "COMMERCIAL" }) })
    );
  });

  it("omits propertyCategory from the update payload when not provided", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_ADMIN as any);
    vi.mocked(prisma.checklistTemplate.update).mockResolvedValue({ id: "t1" } as any);

    const req = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ isActive: false }),
      headers: { "Content-Type": "application/json" },
    });
    await PATCH(req, { params: { id: "t1" } });

    const call = vi.mocked(prisma.checklistTemplate.update).mock.calls[0][0];
    expect(call.data).not.toHaveProperty("propertyCategory");
  });
});
