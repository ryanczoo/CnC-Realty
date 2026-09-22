import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/api-auth", () => ({
  getFileAndVerifyAccess: vi.fn(),
  assertFileEditable: vi.fn(() => null),
  checkOwnership: vi.fn(),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fileTask: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    fileActivity: { create: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
    fileCondition: { create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { getFileAndVerifyAccess, checkOwnership, requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { POST as postTask } from "../../app/api/file-tasks/route";
import { POST as postNote } from "../../app/api/files/[fileType]/[id]/note/route";
import { POST as postCondition } from "../../app/api/transactions/[id]/conditions/route";

const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const json = (body: unknown) =>
  new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
  vi.mocked(getFileAndVerifyAccess).mockResolvedValue({ id: "f1", agentId: "a1", status: "PENDING" } as any);
  vi.mocked(checkOwnership).mockReturnValue({ exists: true, forbidden: false, record: { id: "tf1", agentId: "a1", status: "PENDING" } } as any);
  vi.mocked(requireAuth).mockResolvedValue({ session: AGENT, error: null } as any);
  vi.mocked(prisma.fileTask.create).mockResolvedValue({ id: "t1" } as any);
  vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", status: "PENDING" } as any);
  vi.mocked(prisma.fileCondition.create).mockResolvedValue({ id: "c1" } as any);
});

describe("whitespace is trimmed on tasks, notes, and conditions", () => {
  it("POST /api/file-tasks trims assigneeName even without its own inline .trim()", async () => {
    await postTask(json({ fileType: "transaction", fileId: "f1", title: "Call lender", assigneeName: "  Ann  " }));
    const data = vi.mocked(prisma.fileTask.create).mock.calls[0][0].data as any;
    expect(data.assigneeName).toBe("Ann");
  });

  it("POST note trims the note text", async () => {
    await postNote(json({ note: "  call back  " }), { params: { fileType: "transaction", id: "f1" } });
    const data = vi.mocked(prisma.fileActivity.create).mock.calls[0][0].data as any;
    expect(data.note).toBe("call back");
  });

  it("POST condition trims name and notes", async () => {
    await postCondition(json({ name: "  Inspection  ", notes: " ok " }), { params: { id: "tf1" } });
    const data = vi.mocked(prisma.fileCondition.create).mock.calls[0][0].data as any;
    expect(data.name).toBe("Inspection");
    expect(data.notes).toBe("ok");
  });
});
