import { SITE_URL } from "@/lib/seo";

const ENDPOINT = "https://api.indexnow.org/indexnow";
const TIMEOUT_MS = 5000;
// IndexNow accepts at most 10,000 urls per request.
const MAX_URLS = 10_000;

export function buildIndexNowPayload(urls: string[], key: string) {
  return {
    host: "cncrealtygroup.com" as const,
    key,
    keyLocation: `${SITE_URL}/indexnow-key.txt` as const,
    urlList: Array.from(new Set(urls)).slice(0, MAX_URLS),
  };
}

// Tells Bing (and the other IndexNow engines) which urls just changed. Called
// at the very end of a delta sync, so it must never throw or hold the sync up:
// failures are logged and swallowed, and the request gives up after 5 s. Stays
// silent when INDEXNOW_KEY isn't set (local dev) or there is nothing to send.
export async function pingIndexNow(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY;
  if (!key || urls.length === 0) return;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(buildIndexNowPayload(urls, key)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) console.error(`[idx-sync] IndexNow ping rejected: HTTP ${res.status}`);
  } catch (err) {
    console.error("[idx-sync] IndexNow ping failed:", err);
  }
}
