import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/file-status", () => ({ changeFileStatus: vi.fn() }));

import { getServerSession } from "next-auth";
import { changeFileStatus } from "@/lib/file-status";
import { PATCH } from "../../app/api/admin/files/[fileType]/[id]/status/route";

const ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: null } };
const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const call = (fileType: string, body: unknown) =>
  PATCH(new Request("http://localhost", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), {
    params: { fileType, id: "f1" },
  });

describe("PATCH /api/admin/files/[fileType]/[id]/status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for a non-admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    expect((await call("transaction", { status: "CLOSED" })).status).toBe(403);
    expect(changeFileStatus).not.toHaveBeenCalled();
  });

  it("returns 400 when status is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    expect((await call("transaction", {})).status).toBe(400);
  });

  it("passes the file, status and admin actor to changeFileStatus", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(changeFileStatus).mockResolvedValue({ ok: true, file: {} });
    const res = await call("listing", { status: "CLOSED" });
    expect(changeFileStatus).toHaveBeenCalledWith({
      kind: "listing", fileId: "f1", toStatus: "CLOSED", actor: { userId: "admin1", role: "ADMIN" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("treats any file type other than listing as a transaction (existing behavior)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(changeFileStatus).mockResolvedValue({ ok: true, file: {} });
    await call("transaction", { status: "PENDING" });
    expect(changeFileStatus).toHaveBeenCalledWith(expect.objectContaining({ kind: "transaction" }));
  });

  it("returns the function's error and status code", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(changeFileStatus).mockResolvedValue({ ok: false, status: 404, error: "Not found" });
    const res = await call("transaction", { status: "CLOSED" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("passes the email warning through to the admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(changeFileStatus).mockResolvedValue({ ok: true, file: {}, emailWarning: true });
    expect(await (await call("transaction", { status: "CLOSED" })).json()).toEqual({ ok: true, emailWarning: true });
  });
});
