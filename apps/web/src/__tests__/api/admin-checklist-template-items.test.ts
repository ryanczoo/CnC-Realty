import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: { checklistTemplateItem: { create: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/admin/checklist-templates/[id]/items/route";
import { PATCH } from "../../app/api/admin/checklist-templates/[id]/items/[itemId]/route";

const ADMIN = { user: { id: "admin1", role: "ADMIN" } };
const AGENT = { user: { id: "u1", role: "AGENT" } };
const req = (method: string, body: unknown) => new Request("http://localhost", { method, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
  vi.mocked(prisma.checklistTemplateItem.create).mockResolvedValue({ id: "i1" } as any);
  vi.mocked(prisma.checklistTemplateItem.update).mockResolvedValue({ id: "i1" } as any);
});

describe("admin checklist items — built before", () => {
  it("creates an item with a built-before year", async () => {
    expect((await POST(req("POST", { name: "LPD", order: 3, builtBefore: 1978 }), { params: { id: "t1" } })).status).toBe(201);
    expect(vi.mocked(prisma.checklistTemplateItem.create).mock.calls[0][0].data).toMatchObject({ builtBefore: 1978 });
  });
  it("blank means every file", async () => {
    await POST(req("POST", { name: "RLA", order: 1, builtBefore: "" }), { params: { id: "t1" } });
    expect(vi.mocked(prisma.checklistTemplateItem.create).mock.calls[0][0].data).toMatchObject({ builtBefore: null });
  });
  it("updates and clears the year", async () => {
    await PATCH(req("PATCH", { builtBefore: "1960" }), { params: { id: "t1", itemId: "i1" } });
    expect(vi.mocked(prisma.checklistTemplateItem.update).mock.calls[0][0].data).toEqual({ builtBefore: 1960 });
    await PATCH(req("PATCH", { builtBefore: null }), { params: { id: "t1", itemId: "i1" } });
    expect(vi.mocked(prisma.checklistTemplateItem.update).mock.calls[1][0].data).toEqual({ builtBefore: null });
  });
  it("refuses a year outside the range", async () => {
    const res = await PATCH(req("PATCH", { builtBefore: 1400 }), { params: { id: "t1", itemId: "i1" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/^Built before must be between 1500 and \d{4}$/);
    expect((await POST(req("POST", { name: "X", order: 1, builtBefore: "3000" }), { params: { id: "t1" } })).status).toBe(400);
  });
  it("stays admin-only", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    expect((await PATCH(req("PATCH", { builtBefore: 1978 }), { params: { id: "t1", itemId: "i1" } })).status).toBe(403);
  });
});
