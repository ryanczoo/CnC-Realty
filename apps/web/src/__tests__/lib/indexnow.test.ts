import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildIndexNowPayload, pingIndexNow } from "@/lib/indexnow";

const KEY = "0123456789abcdef0123456789abcdef";

describe("buildIndexNowPayload", () => {
  it("returns the host, key and key location for the site", () => {
    expect(buildIndexNowPayload(["https://cncrealtygroup.com/properties/A"], KEY)).toEqual({
      host: "cncrealtygroup.com",
      key: KEY,
      keyLocation: "https://cncrealtygroup.com/indexnow-key.txt",
      urlList: ["https://cncrealtygroup.com/properties/A"],
    });
  });

  it("removes duplicate urls and keeps first-seen order", () => {
    const { urlList } = buildIndexNowPayload(["https://x/a", "https://x/b", "https://x/a"], KEY);
    expect(urlList).toEqual(["https://x/a", "https://x/b"]);
  });

  it("caps the list at 10,000 urls", () => {
    const urls = Array.from({ length: 12_000 }, (_, i) => `https://x/${i}`);
    expect(buildIndexNowPayload(urls, KEY).urlList).toHaveLength(10_000);
  });
});

describe("pingIndexNow", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.INDEXNOW_KEY = KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.INDEXNOW_KEY;
  });

  it("does nothing when INDEXNOW_KEY is unset", async () => {
    delete process.env.INDEXNOW_KEY;
    await pingIndexNow(["https://cncrealtygroup.com/properties/A"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when there are no urls", async () => {
    await pingIndexNow([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs the payload as JSON to the IndexNow endpoint with a timeout signal", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await pingIndexNow(["https://cncrealtygroup.com/properties/A"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.indexnow.org/indexnow");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toMatch(/application\/json/);
    expect(JSON.parse(init.body)).toEqual(
      buildIndexNowPayload(["https://cncrealtygroup.com/properties/A"], KEY)
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("resolves without throwing when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(pingIndexNow(["https://x/a"])).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("resolves without throwing when the request is aborted by the timeout", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));
    await expect(pingIndexNow(["https://x/a"])).resolves.toBeUndefined();
  });

  it("logs and resolves when IndexNow answers with an error status", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    await expect(pingIndexNow(["https://x/a"])).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
