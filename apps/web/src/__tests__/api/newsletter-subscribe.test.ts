import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/rate-limit", () => ({ publicFormRateLimit: { limit: vi.fn() } }));
vi.mock("@/lib/newsletter", () => ({ subscribeToNewsletter: vi.fn().mockResolvedValue(undefined) }));

import { publicFormRateLimit } from "@/lib/rate-limit";
import { subscribeToNewsletter } from "@/lib/newsletter";
import { POST } from "../../app/api/newsletter/subscribe/route";

const subscribe = (email: string) =>
  POST(new Request("http://localhost/api/newsletter/subscribe", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
  }));

describe("POST /api/newsletter/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(publicFormRateLimit.limit).mockResolvedValue({ success: true, reset: Date.now() + 60000 } as any);
  });

  it("refuses an invalid email without subscribing anyone", async () => {
    const res = await subscribe("not an email");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Please enter a valid email address.");
    expect(subscribeToNewsletter).not.toHaveBeenCalled();
  });

  it("subscribes the trimmed address as a footer signup and always answers ok", async () => {
    const res = await subscribe("  sam@example.com ");
    expect(await res.json()).toEqual({ ok: true });
    expect(subscribeToNewsletter).toHaveBeenCalledWith({ email: "sam@example.com", source: "footer" });
  });

  it("is rate limited like the other public forms", async () => {
    vi.mocked(publicFormRateLimit.limit).mockResolvedValue({ success: false, reset: Date.now() + 60000 } as any);
    const res = await subscribe("sam@example.com");
    expect(res.status).toBe(429);
    expect(subscribeToNewsletter).not.toHaveBeenCalled();
  });
});
