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
vi.mock("@/lib/ica-pdf", () => ({ generateSignedIcaPdf: vi.fn().mockResolvedValue(Buffer.from("countersigned-pdf")) }));
vi.mock("@/lib/r2", () => ({ uploadToR2: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendApprovalDocuments } from "@/lib/email";
import { generateSignedIcaPdf } from "@/lib/ica-pdf";
import { uploadToR2 } from "@/lib/r2";
import * as Sentry from "@sentry/nextjs";
import { POST } from "../../app/api/agent-applications/[id]/approve/route";

const FULLY_SIGNED_APPLICATION = {
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
  signedName: "Jane Smith",
  icaAgreedAt: new Date("2026-07-06T12:00:00.000Z"),
  submissionIp: "1.2.3.4",
  icaVersion: "2026-07-06",
};

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

  it("regenerates the ICA PDF with a broker countersignature and re-uploads it to the same R2 key", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { email: "admin@cnc.com" } },
      error: undefined,
    } as any);
    vi.mocked(prisma.agentApplication.findUnique).mockResolvedValue(FULLY_SIGNED_APPLICATION as any);
    vi.mocked(prisma.agentApplication.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-1" } as any);
    vi.mocked(prisma.agent.create).mockResolvedValue({ id: "agent-1" } as any);

    const req = new Request("http://localhost/api/agent-applications/app-1/approve", { method: "POST" });
    const res = await POST(req, { params: { id: "app-1" } });

    expect(res.status).toBe(200);
    expect(generateSignedIcaPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        signerName: "Jane Smith",
        signedAt: FULLY_SIGNED_APPLICATION.icaAgreedAt,
        signerIp: "1.2.3.4",
        licenseNumber: "01234567",
        icaVersion: "2026-07-06",
        brokerSignedAt: expect.any(Date),
      })
    );
    expect(uploadToR2).toHaveBeenCalledWith(
      "signed-ica/app-1.pdf",
      Buffer.from("countersigned-pdf"),
      "application/pdf"
    );
  });

  it("does not attempt to regenerate the ICA PDF when the application has no signed ICA on file", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { email: "admin@cnc.com" } },
      error: undefined,
    } as any);
    vi.mocked(prisma.agentApplication.findUnique).mockResolvedValue({
      ...FULLY_SIGNED_APPLICATION,
      id: "app-2",
      signedIcaKey: null,
    } as any);
    vi.mocked(prisma.agentApplication.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-2" } as any);
    vi.mocked(prisma.agent.create).mockResolvedValue({ id: "agent-2" } as any);

    const req = new Request("http://localhost/api/agent-applications/app-2/approve", { method: "POST" });
    const res = await POST(req, { params: { id: "app-2" } });

    expect(res.status).toBe(200);
    expect(generateSignedIcaPdf).not.toHaveBeenCalled();
    expect(uploadToR2).not.toHaveBeenCalled();
  });

  it("captures the error via Sentry and still returns 200 when the countersignature regeneration fails", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { email: "admin@cnc.com" } },
      error: undefined,
    } as any);
    vi.mocked(prisma.agentApplication.findUnique).mockResolvedValue(FULLY_SIGNED_APPLICATION as any);
    vi.mocked(prisma.agentApplication.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-1" } as any);
    vi.mocked(prisma.agent.create).mockResolvedValue({ id: "agent-1" } as any);
    const uploadError = new Error("R2 unreachable");
    vi.mocked(uploadToR2).mockRejectedValueOnce(uploadError);

    const req = new Request("http://localhost/api/agent-applications/app-1/approve", { method: "POST" });
    const res = await POST(req, { params: { id: "app-1" } });

    expect(res.status).toBe(200);
    expect(Sentry.captureException).toHaveBeenCalledWith(uploadError);
  });
});
