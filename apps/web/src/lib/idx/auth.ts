import { prisma } from "@/lib/prisma";
import { withRetry } from "./retry";

// A 4xx from the token endpoint means bad credentials/config — retrying won't
// fix that. 5xx and network errors are treated as transient and retried.
class PermanentAuthError extends Error {}

const TOKEN_URL = "https://api-trestle.corelogic.com/trestle/oidc/connect/token";
const SETTINGS_KEY = "crmls_token_cache";

interface TokenCache {
  token: string;
  expiresAt: number; // Unix ms
}

export async function getResoToken(): Promise<string> {
  // 1. Check cache in SiteSettings
  const cached = await prisma.siteSettings.findUnique({ where: { key: SETTINGS_KEY } });
  if (cached) {
    const data = JSON.parse(cached.value) as TokenCache;
    if (Date.now() < data.expiresAt - 60_000) {
      return data.token;
    }
  }

  // 2. Fetch new token (transient failures are retried; bad credentials/config are not)
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.CRMLS_CLIENT_ID!,
    client_secret: process.env.CRMLS_CLIENT_SECRET!,
    scope: "api",
  });

  const json = await withRetry(
    async () => {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!res.ok) {
        const text = await res.text();
        if (res.status < 500) throw new PermanentAuthError(`CRMLS token fetch failed: ${res.status} ${text}`);
        throw new Error(`CRMLS token fetch failed: ${res.status} ${text}`);
      }

      return res.json() as Promise<{ access_token: string; expires_in: number }>;
    },
    { shouldRetry: (err) => !(err instanceof PermanentAuthError) }
  );
  const expiresAt = Date.now() + json.expires_in * 1000;

  // 3. Persist to SiteSettings
  const cacheValue: TokenCache = { token: json.access_token, expiresAt };
  await prisma.siteSettings.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: JSON.stringify(cacheValue) },
    update: { value: JSON.stringify(cacheValue) },
  });

  return json.access_token;
}
