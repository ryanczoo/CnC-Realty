import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    blogPost: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/blog/route";
import { PUT } from "../../app/api/blog/[id]/route";

function makeRequest(url: string, body: object, method = "POST") {
  return new Request(url, {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/blog — Zod validation error message", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "agent-1", email: "agent@cnc.com", role: "AGENT", agentId: "a1" } },
      error: null,
    } as any);
  });

  it("returns the specific validation message for an invalid submission, not a crash", async () => {
    const res = await POST(makeRequest("http://localhost/api/blog", { title: "", slug: "no-title" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Title required");
    expect(prisma.blogPost.create).not.toHaveBeenCalled();
  });
});

describe("PUT /api/blog/[id] — Zod validation error message", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "agent-1", email: "agent@cnc.com", role: "AGENT", agentId: "a1" } },
      error: null,
    } as any);
    vi.mocked(prisma.blogPost.findUnique).mockResolvedValue({
      id: "post-1",
      authorId: "agent-1",
    } as any);
  });

  it("returns the specific validation message for an invalid submission, not a crash", async () => {
    const res = await PUT(
      makeRequest("http://localhost/api/blog/post-1", { coverImage: "not-a-url" }, "PUT"),
      { params: { id: "post-1" } }
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid URL");
    expect(prisma.blogPost.update).not.toHaveBeenCalled();
  });
});
