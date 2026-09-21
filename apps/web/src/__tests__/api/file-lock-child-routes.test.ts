import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/r2", () => ({
  getPresignedPutUrl: vi.fn(),
  buildR2Key: vi.fn(() => "k/__doc__/__name__"),
  deleteR2Object: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
    fileTask: { findUnique: vi.fn() },
    fileParty: { findUnique: vi.fn() },
    fileActivity: { create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST as postDocument } from "../../app/api/documents/route";
import { GET as getUploadUrl } from "../../app/api/upload-url/route";
import { POST as postTask } from "../../app/api/file-tasks/route";
import { PATCH as patchTask, DELETE as deleteTask } from "../../app/api/file-tasks/[taskId]/route";
import { POST as postNote } from "../../app/api/files/[fileType]/[id]/note/route";
import { POST as postParty } from "../../app/api/files/[fileType]/[id]/parties/route";
import { PATCH as patchParty, DELETE as deleteParty } from "../../app/api/files/[fileType]/[id]/parties/[partyId]/route";

const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: null } };
const LOCK_MESSAGE = "This file is closed and can't be changed";

function json(body: unknown) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const noBody = () => new Request("http://localhost");

const CALLS: [string, () => Promise<Response>][] = [
  ["POST /api/documents", () => postDocument(json({ fileType: "TRANSACTION", fileId: "f1", name: "a.pdf", r2Key: "k", r2Url: "k" }))],
  ["GET /api/upload-url", () => getUploadUrl(new Request("http://localhost/api/upload-url?fileType=transaction&fileId=f1&filename=a.pdf&contentType=application/pdf&size=10"))],
  ["POST /api/file-tasks", () => postTask(json({ fileType: "transaction", fileId: "f1", title: "t" }))],
  ["PATCH /api/file-tasks/[taskId]", () => patchTask(json({ done: true }), { params: { taskId: "t1" } })],
  ["DELETE /api/file-tasks/[taskId]", () => deleteTask(noBody(), { params: { taskId: "t1" } })],
  ["POST note", () => postNote(json({ note: "hi" }), { params: { fileType: "transaction", id: "f1" } })],
  ["POST parties", () => postParty(json({ role: "BUYER", name: "n" }), { params: { fileType: "transaction", id: "f1" } })],
  ["PATCH party", () => patchParty(json({ name: "n" }), { params: { fileType: "transaction", id: "f1", partyId: "p1" } })],
  ["DELETE party", () => deleteParty(noBody(), { params: { fileType: "transaction", id: "f1", partyId: "p1" } })],
];

function mockTransaction(status: string) {
  vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1", status } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.fileTask.findUnique).mockResolvedValue({ id: "t1", transactionFileId: "f1", listingFileId: null } as any);
  vi.mocked(prisma.fileParty.findUnique).mockResolvedValue({ id: "p1", transactionFileId: "f1", listingFileId: null } as any);
  vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
});

describe("closed files are read-only for agents", () => {
  it.each(CALLS)("%s returns the lock 403 when the file is closed", async (_name, call) => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    mockTransaction("CLOSED");
    const res = await call();
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(LOCK_MESSAGE);
  });

  it.each(["CLOSED", "ARCHIVED", "CANCELED_APPROVED"])("blocks a note on a transaction that is %s", async (status) => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    mockTransaction(status);
    const res = await postNote(json({ note: "hi" }), { params: { fileType: "transaction", id: "f1" } });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(LOCK_MESSAGE);
  });

  it.each(["CLOSED", "CANCELED"])("blocks a note on a listing that is %s", async (status) => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1", status } as any);
    const res = await postNote(json({ note: "hi" }), { params: { fileType: "listing", id: "f1" } });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(LOCK_MESSAGE);
  });

  it("still lets an agent add a note to an open file", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    mockTransaction("PENDING");
    const res = await postNote(json({ note: "hi" }), { params: { fileType: "transaction", id: "f1" } });
    expect(res.status).toBe(200);
  });

  it("still lets an admin add a note to a closed file", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    mockTransaction("CLOSED");
    const res = await postNote(json({ note: "hi" }), { params: { fileType: "transaction", id: "f1" } });
    expect(res.status).toBe(200);
  });
});
