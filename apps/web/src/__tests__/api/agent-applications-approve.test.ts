import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendApplicationApproved: vi.fn().mockResolvedValue(undefined),
  sendApprovalDocuments: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn().mockResolvedValue("hashed-password") } }));
vi.mock("@/lib/prisma", () => {
  const mockPrisma: any = {
    agentApplication: { findUnique: vi.fn(), updateMany: vi.fn() },
    user: { create: vi.fn() },
    agent: { create: vi.fn() },
  };
  mockPrisma.$transaction = vi.fn(async (cb: any) => cb(mockPrisma));
  return { prisma: mockPrisma };
});

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendApprovalDocuments } from "@/lib/email";
import { POST } from "../../app/api/agent-applications/[id]/approve/route";

describe("POST /api/agent-applications/[id]/approve", () => {
  beforeEach(() => vi.clearAllMocks());

  it("copies signedIcaKey from the application onto the new Agent record", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { email: "admin@cnc.com" } },
      error: undefined,
    } as any);
    vi.mocked(prisma.agentApplication.findUnique).mockResolvedValue({
      id: "app-1",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      phone: "555-123-4567",
      licenseNumber: "01234567",
      yearsLicensed: 5,
      specialties: [],
      bio: null,
      instagramUrl: null,
      facebookUrl: null,
      signedIcaKey: "signed-ica/app-1.pdf",
    } as any);
    vi.mocked(prisma.agentApplication.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-1" } as any);
    vi.mocked(prisma.agent.create).mockResolvedValue({ id: "agent-1" } as any);

    const req = new Request("http://localhost/api/agent-applications/app-1/approve", { method: "POST" });
    const res = await POST(req, { params: { id: "app-1" } });

    expect(res.status).toBe(200);
    expect(prisma.agent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ signedIcaKey: "signed-ica/app-1.pdf" }),
      })
    );
  });

  it("sets signedIcaKey to null on the new Agent when the application has none", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { email: "admin@cnc.com" } },
      error: undefined,
    } as any);
    vi.mocked(prisma.agentApplication.findUnique).mockResolvedValue({
      id: "app-2",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "555-987-6543",
      licenseNumber: "09876543",
      yearsLicensed: 2,
      specialties: [],
      bio: null,
      instagramUrl: null,
      facebookUrl: null,
      signedIcaKey: null,
    } as any);
    vi.mocked(prisma.agentApplication.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-2" } as any);
    vi.mocked(prisma.agent.create).mockResolvedValue({ id: "agent-2" } as any);

    const req = new Request("http://localhost/api/agent-applications/app-2/approve", { method: "POST" });
    const res = await POST(req, { params: { id: "app-2" } });

    expect(res.status).toBe(200);
    expect(prisma.agent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ signedIcaKey: null }),
      })
    );
  });

  it("sends the onboarding documents email to the newly-approved agent", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { email: "admin@cnc.com" } },
      error: undefined,
    } as any);
    vi.mocked(prisma.agentApplication.findUnique).mockResolvedValue({
      id: "app-3",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      phone: "555-123-4567",
      licenseNumber: "01234567",
      yearsLicensed: 5,
      specialties: [],
      bio: null,
      instagramUrl: null,
      facebookUrl: null,
      signedIcaKey: null,
    } as any);
    vi.mocked(prisma.agentApplication.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-3" } as any);
    vi.mocked(prisma.agent.create).mockResolvedValue({ id: "agent-3" } as any);

    const req = new Request("http://localhost/api/agent-applications/app-3/approve", { method: "POST" });
    const res = await POST(req, { params: { id: "app-3" } });

    expect(res.status).toBe(200);
    expect(sendApprovalDocuments).toHaveBeenCalledWith("jane@example.com", "Jane");
  });
});
