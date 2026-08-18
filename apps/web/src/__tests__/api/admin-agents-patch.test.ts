import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { agent: { update: vi.fn() } } }));

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { PATCH } from "../../app/api/admin/agents/[id]/route";

function req(body: unknown) {
  return new Request("http://localhost/api/admin/agents/a1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/agents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({ session: { user: { role: "ADMIN" } }, error: null } as any);
  });

  it("updates title only, unchanged from existing behavior", async () => {
    vi.mocked(prisma.agent.update).mockResolvedValue({ id: "a1", title: "Listing Specialist" } as any);

    const res = await PATCH(req({ title: "Listing Specialist" }), { params: { id: "a1" } });

    expect(res.status).toBe(200);
    expect(prisma.agent.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { title: "Listing Specialist" },
      select: { id: true, title: true, monthlyEmailLimit: true },
    });
  });

  it("still 400s on an empty title, unchanged from existing behavior", async () => {
    const res = await PATCH(req({ title: "   " }), { params: { id: "a1" } });
    expect(res.status).toBe(400);
    expect(prisma.agent.update).not.toHaveBeenCalled();
  });

  it("updates monthlyEmailLimit only, with no title in the request", async () => {
    vi.mocked(prisma.agent.update).mockResolvedValue({ id: "a1", monthlyEmailLimit: 500 } as any);

    const res = await PATCH(req({ monthlyEmailLimit: 500 }), { params: { id: "a1" } });

    expect(res.status).toBe(200);
    expect(prisma.agent.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { monthlyEmailLimit: 500 },
      select: { id: true, title: true, monthlyEmailLimit: true },
    });
  });

  it("rejects a negative monthlyEmailLimit", async () => {
    const res = await PATCH(req({ monthlyEmailLimit: -5 }), { params: { id: "a1" } });
    expect(res.status).toBe(400);
    expect(prisma.agent.update).not.toHaveBeenCalled();
  });

  it("rejects a non-integer monthlyEmailLimit", async () => {
    const res = await PATCH(req({ monthlyEmailLimit: 12.5 }), { params: { id: "a1" } });
    expect(res.status).toBe(400);
    expect(prisma.agent.update).not.toHaveBeenCalled();
  });

  it("accepts both fields together", async () => {
    vi.mocked(prisma.agent.update).mockResolvedValue({ id: "a1" } as any);

    const res = await PATCH(req({ title: "Broker", monthlyEmailLimit: 300 }), { params: { id: "a1" } });

    expect(res.status).toBe(200);
    expect(prisma.agent.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { title: "Broker", monthlyEmailLimit: 300 },
      select: { id: true, title: true, monthlyEmailLimit: true },
    });
  });

  it("400s when neither field is present", async () => {
    const res = await PATCH(req({}), { params: { id: "a1" } });
    expect(res.status).toBe(400);
    expect(prisma.agent.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the agent does not exist", async () => {
    vi.mocked(prisma.agent.update).mockRejectedValue(new Error("not found"));
    const res = await PATCH(req({ title: "Broker" }), { params: { id: "missing" } });
    expect(res.status).toBe(404);
  });
});
