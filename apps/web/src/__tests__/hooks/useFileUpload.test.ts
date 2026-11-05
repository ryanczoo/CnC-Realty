import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadDocument } from "@/hooks/useFileUpload";
import { AGENT_VIEW_HEADER } from "@/lib/agent-view";

const globalFetch = vi.fn();
beforeEach(() => { globalFetch.mockReset(); vi.stubGlobal("fetch", globalFetch); });
afterEach(() => vi.unstubAllGlobals());

const file = new File(["x"], "a.pdf", { type: "application/pdf" });

function wire() {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/upload-url")) {
      return { ok: true, json: async () => ({ uploadUrl: "https://r2.example/put", key: "k1", documentId: "d1" }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
  globalFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  return fetchImpl as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe("uploadDocument fetchImpl", () => {
  it("sends the upload-url and documents calls through fetchImpl", async () => {
    const fetchImpl = wire();
    const result = await uploadDocument("TRANSACTION", "f1", "i1", file, undefined, fetchImpl);
    expect(result).toEqual({ name: "a.pdf", ok: true });
    const urls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.startsWith("/api/upload-url"))).toBe(true);
    expect(urls).toContain("/api/documents");
    expect(urls).not.toContain("https://r2.example/put");
  });

  it("sends the R2 PUT through global fetch with only a Content-Type header", async () => {
    const fetchImpl = wire();
    await uploadDocument("TRANSACTION", "f1", "i1", file, undefined, fetchImpl);
    expect(globalFetch).toHaveBeenCalledTimes(1);
    const [url, init] = globalFetch.mock.calls[0];
    expect(url).toBe("https://r2.example/put");
    expect(init.method).toBe("PUT");
    expect(init.headers).toEqual({ "Content-Type": "application/pdf" });
    expect(Object.keys(init.headers)).not.toContain(AGENT_VIEW_HEADER);
  });

  it("defaults to global fetch for everything when no fetchImpl is given", async () => {
    globalFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ uploadUrl: "https://r2.example/put", key: "k1", documentId: "d1" }) })
      .mockResolvedValue({ ok: true, json: async () => ({}) });
    const result = await uploadDocument("LISTING", "f1", null, file);
    expect(result.ok).toBe(true);
    expect(globalFetch).toHaveBeenCalledTimes(3);
  });
});
