import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    siteSettings: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getResoToken } from "@/lib/idx/auth";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

const TOKEN_BODY = { access_token: "fresh-token", expires_in: 3600 };

describe("getResoToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(prisma.siteSettings.findUnique).mockResolvedValue(null);
    vi.stubGlobal("fetch", vi.fn());
    vi.useFakeTimers();
    process.env.CRMLS_CLIENT_ID = "id";
    process.env.CRMLS_CLIENT_SECRET = "secret";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function callFast() {
    const p = getResoToken();
    p.catch(() => {});
    await vi.advanceTimersByTimeAsync(100_000);
    return p;
  }

  it("returns the cached token when it is not yet expired", async () => {
    vi.mocked(prisma.siteSettings.findUnique).mockResolvedValue({
      key: "crmls_token_cache",
      value: JSON.stringify({ token: "cached-token", expiresAt: Date.now() + 60 * 60 * 1000 }),
    } as any);

    const token = await callFast();

    expect(token).toBe("cached-token");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retries after a transient 5xx from the token endpoint and succeeds", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500))
      .mockResolvedValueOnce(jsonResponse(TOKEN_BODY));

    const token = await callFast();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(token).toBe("fresh-token");
  });

  it("retries after a network-level throw and succeeds", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(jsonResponse(TOKEN_BODY));

    const token = await callFast();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(token).toBe("fresh-token");
  });

  it("does not retry a 4xx credential/config error and throws immediately", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: "invalid_client" }, 400));

    await expect(callFast()).rejects.toThrow(/400/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting retries on a persistently failing token endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "boom" }, 500));

    await expect(callFast()).rejects.toThrow(/500/);
    expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(1);
  });
});
