# Phase 6: Polish & Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship CnC Realty to production at cncrealtygroup.com with ISR caching, SEO structured data, rate limiting, error monitoring, analytics, and a live Vercel + Railway deploy.

**Architecture:** Cross-cutting infrastructure only — no business logic changes. Performance (ISR, Redis) and SEO (JSON-LD, sitemap) are additive. Security (Zod on saved-searches, rate limiting on leads) hardens the public API surface. Sentry and PostHog are thin wrappers. Deploy is the final gate.

**Tech Stack:** Next.js 14 ISR/sitemap, Upstash `@upstash/redis` + `@upstash/ratelimit`, Zod (already installed v4.4.3), `@sentry/nextjs`, `posthog-js`

**Run all tests with:** `pnpm --filter web test`

**Prerequisites (Ryan sets up before Task 9):**
- Sentry: sentry.io → New Project → Next.js → copy DSN → set `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_AUTH_TOKEN` in `.env.local`
- PostHog: posthog.com → New Project → copy API key and host → set `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` in `.env.local`
- Confirm `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are in `apps/web/.env.local`

---

## File Structure

**New files:**
- `apps/web/src/app/(listings)/properties/loading.tsx` — skeleton loader for property search page
- `apps/web/src/app/sitemap.ts` — dynamic sitemap with property + agent URLs
- `apps/web/src/app/robots.ts` — robots.txt config
- `apps/web/src/lib/json-ld.ts` — JSON-LD schema builders (RealEstateListing, Person, LocalBusiness)
- `apps/web/src/lib/redis.ts` — Upstash Redis singleton
- `apps/web/src/lib/rate-limit.ts` — rate limiter for public forms (10 req/min per IP)
- `apps/web/sentry.client.config.ts` — Sentry browser init
- `apps/web/sentry.server.config.ts` — Sentry server init
- `apps/web/sentry.edge.config.ts` — Sentry edge init
- `apps/web/src/__tests__/lib/json-ld.test.ts` — unit tests for JSON-LD builders
- `apps/web/src/components/ui/CookieBanner.tsx` — CCPA cookie consent banner UI
- `apps/web/src/hooks/useCookieConsent.ts` — consent preference hook (reads/writes cookie)

**Modified files:**
- `apps/web/src/app/(listings)/properties/[mlsNumber]/page.tsx` — add `revalidate` + JSON-LD
- `apps/web/src/app/(agents)/agents/[slug]/page.tsx` — add `revalidate` + JSON-LD
- `apps/web/src/app/page.tsx` — add LocalBusiness JSON-LD
- `apps/web/src/app/api/properties/route.ts` — add Redis caching
- `apps/web/src/app/api/leads/route.ts` — add rate limiting
- `apps/web/src/app/api/saved-searches/route.ts` — add Zod validation
- `apps/web/src/components/Providers.tsx` — add PostHog init gated on cookie consent + PostHogPageView
- `apps/web/next.config.mjs` — wrap with `withSentryConfig`
- `apps/web/src/app/layout.tsx` — mount `<CookieBanner />`
- `apps/web/src/components/layout/Footer.tsx` — add "Do Not Sell or Share My Personal Information" link

---

## Task 1: ISR on Property Detail and Agent Profile Pages

Add `export const revalidate = 300` so Next.js caches these pages for 5 minutes instead of server-rendering every request.

**Files:**
- Modify: `apps/web/src/app/(listings)/properties/[mlsNumber]/page.tsx`
- Modify: `apps/web/src/app/(agents)/agents/[slug]/page.tsx`

- [ ] **Step 1: Add revalidate to property detail page**

Open `apps/web/src/app/(listings)/properties/[mlsNumber]/page.tsx` and add this line immediately after the imports, before the `interface PageProps` line:

```typescript
export const revalidate = 300;
```

- [ ] **Step 2: Add revalidate to agent profile page**

Open `apps/web/src/app/(agents)/agents/[slug]/page.tsx` and add this line immediately after the imports (after `import type { Metadata } from "next";`):

```typescript
export const revalidate = 300;
```

- [ ] **Step 3: Verify build still passes**

```powershell
cd C:\Users\hey_r\Desktop\CnC-Realty
pnpm --filter web build 2>&1 | Select-String -Pattern "error|Error|✓ Compiled" -CaseSensitive:$false | Select-Object -First 20
```

Expected: no TypeScript errors, build completes.

- [ ] **Step 4: Commit**

```powershell
git add apps/web/src/app/"(listings)"/properties/"[mlsNumber]"/page.tsx apps/web/src/app/"(agents)"/agents/"[slug]"/page.tsx
git commit -m "perf: add 5-minute ISR to property detail and agent profile pages"
```

---

## Task 2: Skeleton Loader for Property Search

When a user navigates to `/properties`, Next.js App Router shows `loading.tsx` during the server fetch. This gives immediate visual feedback instead of a blank page.

**Files:**
- Create: `apps/web/src/app/(listings)/properties/loading.tsx`
- Create: `apps/web/src/components/ui/skeleton.tsx` (via shadcn)

- [ ] **Step 1: Install the shadcn skeleton component**

```powershell
cd C:\Users\hey_r\Desktop\CnC-Realty\apps\web
pnpm dlx shadcn@latest add skeleton
```

Expected: `apps/web/src/components/ui/skeleton.tsx` is created.

- [ ] **Step 2: Create the loading file**

Create `apps/web/src/app/(listings)/properties/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function PropertiesLoading() {
  return (
    <div className="flex h-[calc(100vh-64px)] mt-16">
      <div className="w-[45%] overflow-y-auto border-r border-[#E8E6E4] p-4 space-y-4">
        <Skeleton className="h-12 w-full rounded-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl overflow-hidden space-y-2">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
      <div className="flex-1">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify by running dev server and navigating to /properties**

```powershell
cd C:\Users\hey_r\Desktop\CnC-Realty
pnpm --filter web dev
```

Open `http://localhost:3000/properties` — you should see skeleton cards briefly before the real content loads. On fast connections, throttle in browser DevTools (Network → Slow 3G) to see it clearly.

- [ ] **Step 4: Commit**

```powershell
git add apps/web/src/components/ui/skeleton.tsx apps/web/src/app/"(listings)"/properties/loading.tsx
git commit -m "feat: add skeleton loader for property search page"
```

---

## Task 3: Sitemap and robots.txt

Next.js 14 App Router generates these natively from TypeScript files in `src/app/`.

**Files:**
- Create: `apps/web/src/app/sitemap.ts`
- Create: `apps/web/src/app/robots.ts`

- [ ] **Step 1: Create the sitemap**

Create `apps/web/src/app/sitemap.ts`:

```typescript
import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE = "https://cncrealtygroup.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [properties, agents] = await Promise.all([
    prisma.property.findMany({
      select: { mlsNumber: true, updatedAt: true },
      where: { status: { in: ["Active", "Coming Soon"] } },
      orderBy: { updatedAt: "desc" },
      take: 50_000,
    }),
    prisma.agent.findMany({
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), priority: 1.0, changeFrequency: "weekly" },
    { url: `${BASE}/properties`, lastModified: new Date(), priority: 0.9, changeFrequency: "hourly" },
    { url: `${BASE}/join`, lastModified: new Date(), priority: 0.7, changeFrequency: "monthly" },
    { url: `${BASE}/contact`, lastModified: new Date(), priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/about`, lastModified: new Date(), priority: 0.6, changeFrequency: "monthly" },
  ];

  const propertyRoutes: MetadataRoute.Sitemap = properties.map((p) => ({
    url: `${BASE}/properties/${p.mlsNumber}`,
    lastModified: p.updatedAt,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const agentRoutes: MetadataRoute.Sitemap = agents
    .filter((a) => a.slug)
    .map((a) => ({
      url: `${BASE}/agents/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  return [...staticRoutes, ...agentRoutes, ...propertyRoutes];
}
```

- [ ] **Step 2: Create robots.txt**

Create `apps/web/src/app/robots.ts`:

```typescript
import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/admin/", "/account/", "/api/"],
      },
    ],
    sitemap: "https://cncrealtygroup.com/sitemap.xml",
  };
}
```

- [ ] **Step 3: Verify both routes work in dev**

With dev server running, open:
- `http://localhost:3000/sitemap.xml` — should return XML with property and agent URLs
- `http://localhost:3000/robots.txt` — should return the disallow rules

- [ ] **Step 4: Commit**

```powershell
git add apps/web/src/app/sitemap.ts apps/web/src/app/robots.ts
git commit -m "feat: add dynamic sitemap and robots.txt"
```

---

## Task 4: JSON-LD Structured Data

Adds machine-readable schema.org markup to property listings, agent profiles, and the homepage. Improves Google rich result eligibility.

**Files:**
- Create: `apps/web/src/lib/json-ld.ts`
- Create: `apps/web/src/__tests__/lib/json-ld.test.ts`
- Modify: `apps/web/src/app/(listings)/properties/[mlsNumber]/page.tsx`
- Modify: `apps/web/src/app/(agents)/agents/[slug]/page.tsx`
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/__tests__/lib/json-ld.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { propertyJsonLd, agentJsonLd, localBusinessJsonLd } from "@/lib/json-ld";

const baseProperty = {
  mlsNumber: "A12345",
  address: "123 Main St",
  city: "Pasadena",
  state: "CA",
  zip: "91101",
  listPrice: 850_000,
  beds: 3,
  baths: 2.0,
  sqft: 2000,
  description: "A beautiful home.",
  photos: ["https://cdn.example.com/photo1.jpg"],
  latitude: 34.1478,
  longitude: -118.1445,
};

describe("propertyJsonLd", () => {
  it("sets @type to RealEstateListing", () => {
    expect(propertyJsonLd(baseProperty)["@type"]).toBe("RealEstateListing");
  });

  it("includes the listing price in offers", () => {
    const result = propertyJsonLd(baseProperty);
    expect(result.offers.price).toBe(850_000);
    expect(result.offers.priceCurrency).toBe("USD");
  });

  it("builds the canonical URL from mlsNumber", () => {
    expect(propertyJsonLd(baseProperty).url).toBe(
      "https://cncrealtygroup.com/properties/A12345"
    );
  });

  it("includes geo coordinates when present", () => {
    const result = propertyJsonLd(baseProperty);
    expect(result.geo).toEqual({
      "@type": "GeoCoordinates",
      latitude: 34.1478,
      longitude: -118.1445,
    });
  });

  it("omits geo when coordinates are null", () => {
    const result = propertyJsonLd({ ...baseProperty, latitude: null, longitude: null });
    expect(result.geo).toBeUndefined();
  });

  it("omits floorSize when sqft is null", () => {
    const result = propertyJsonLd({ ...baseProperty, sqft: null });
    expect(result.floorSize).toBeUndefined();
  });
});

describe("agentJsonLd", () => {
  it("sets @type to Person", () => {
    const result = agentJsonLd({ name: "Ryan Chong", slug: "ryan-chong", bio: null, headshot: null, phone: null });
    expect(result["@type"]).toBe("Person");
    expect(result.url).toBe("https://cncrealtygroup.com/agents/ryan-chong");
  });
});

describe("localBusinessJsonLd", () => {
  it("sets @type to RealEstateAgent", () => {
    expect(localBusinessJsonLd()["@type"]).toBe("RealEstateAgent");
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```powershell
cd C:\Users\hey_r\Desktop\CnC-Realty\apps\web
pnpm vitest run src/__tests__/lib/json-ld.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/json-ld'".

- [ ] **Step 3: Create the JSON-LD utility**

Create `apps/web/src/lib/json-ld.ts`:

```typescript
const BASE = "https://cncrealtygroup.com";

export function propertyJsonLd(p: {
  mlsNumber: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  listPrice: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  description: string | null;
  photos: string[] | null;
  latitude: number | null;
  longitude: number | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: p.address,
    url: `${BASE}/properties/${p.mlsNumber}`,
    ...(p.description ? { description: p.description } : {}),
    ...(p.photos?.length ? { image: p.photos.slice(0, 5) } : {}),
    ...(p.beds !== null ? { numberOfRooms: p.beds } : {}),
    ...(p.sqft !== null
      ? { floorSize: { "@type": "QuantitativeValue", value: p.sqft, unitCode: "SQFT" } }
      : {}),
    offers: { "@type": "Offer", price: p.listPrice, priceCurrency: "USD" },
    address: {
      "@type": "PostalAddress",
      streetAddress: p.address,
      addressLocality: p.city,
      addressRegion: p.state,
      postalCode: p.zip,
      addressCountry: "US",
    },
    ...(p.latitude !== null && p.longitude !== null
      ? { geo: { "@type": "GeoCoordinates", latitude: p.latitude, longitude: p.longitude } }
      : {}),
  };
}

export function agentJsonLd(a: {
  name: string;
  slug: string;
  bio: string | null;
  headshot: string | null;
  phone: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: a.name,
    url: `${BASE}/agents/${a.slug}`,
    jobTitle: "Real Estate Agent",
    ...(a.bio ? { description: a.bio } : {}),
    ...(a.headshot ? { image: a.headshot } : {}),
    ...(a.phone ? { telephone: a.phone } : {}),
    worksFor: { "@type": "RealEstateAgent", name: "CnC Realty Group", url: BASE },
  };
}

export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: "CnC Realty Group",
    url: BASE,
    logo: `${BASE}/logo-white.png`,
    email: "info@cncrealtygroup.com",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Los Angeles",
      addressRegion: "CA",
      addressCountry: "US",
    },
    areaServed: "California",
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```powershell
pnpm vitest run src/__tests__/lib/json-ld.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Add JSON-LD to property detail page**

In `apps/web/src/app/(listings)/properties/[mlsNumber]/page.tsx`, inside the `PropertyDetailPage` component, add the JSON-LD script just before the closing tag of the outermost return. Find the line that reads `if (!property) notFound();` and then look at the return statement. Add this import at the top:

```typescript
import { propertyJsonLd } from "@/lib/json-ld";
```

Then in the component's return JSX, add this as the **first child** of the outermost element (place it before the dark header bar div):

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(
      propertyJsonLd({
        mlsNumber: property.mlsNumber,
        address: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
        listPrice: property.listPrice,
        beds: property.beds,
        baths: property.baths,
        sqft: property.sqft,
        description: property.description,
        photos: photos,
        latitude: property.latitude,
        longitude: property.longitude,
      })
    ),
  }}
/>
```

- [ ] **Step 6: Add JSON-LD to agent profile page**

In `apps/web/src/app/(agents)/agents/[slug]/page.tsx`, add import:

```typescript
import { agentJsonLd } from "@/lib/json-ld";
```

In `AgentProfilePage`, add before the `<main>` tag:

```tsx
return (
  <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(
          agentJsonLd({
            name: agent.displayName ?? agent.slug,
            slug: agent.slug,
            bio: agent.bio,
            headshot: agent.headshot,
            phone: agent.phone,
          })
        ),
      }}
    />
    <main>
      {/* existing content */}
    </main>
  </>
);
```

- [ ] **Step 7: Add LocalBusiness JSON-LD to homepage**

In `apps/web/src/app/page.tsx`, add import:

```typescript
import { localBusinessJsonLd } from "@/lib/json-ld";
```

Inside the page component (before or after the existing JSX), add as the first child of the outermost element:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd()) }}
/>
```

- [ ] **Step 8: Verify in browser**

With dev server running, open `http://localhost:3000/properties/<any-mls-number>`. In Chrome DevTools → Elements, search for `application/ld+json` — you should see the JSON-LD script in the `<head>` or `<body>`. Validate it at https://validator.schema.org/ by pasting the JSON.

- [ ] **Step 9: Commit**

```powershell
git add apps/web/src/lib/json-ld.ts apps/web/src/__tests__/lib/json-ld.test.ts apps/web/src/app/"(listings)"/properties/"[mlsNumber]"/page.tsx apps/web/src/app/"(agents)"/agents/"[slug]"/page.tsx apps/web/src/app/page.tsx
git commit -m "feat: add JSON-LD structured data for properties, agents, and homepage"
```

---

## Task 5: Redis Search Result Caching

Caches `/api/properties` responses for 5 minutes. Cuts Prisma query load on popular filter combinations (e.g., default LA home search).

**Files:**
- Create: `apps/web/src/lib/redis.ts`
- Modify: `apps/web/src/app/api/properties/route.ts`

- [ ] **Step 1: Install Upstash Redis**

```powershell
cd C:\Users\hey_r\Desktop\CnC-Realty
pnpm add --filter web @upstash/redis
```

- [ ] **Step 2: Create Redis singleton**

Create `apps/web/src/lib/redis.ts`:

```typescript
import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();
```

`Redis.fromEnv()` reads `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from env automatically.

- [ ] **Step 3: Add caching to the properties API route**

In `apps/web/src/app/api/properties/route.ts`, add these imports at the top:

```typescript
import { redis } from "@/lib/redis";
```

Then, inside the `GET` handler, **before the `try` block that runs the Prisma query**, add the cache-read logic:

```typescript
// Build a deterministic cache key from sorted search params
const rawParams = new URL(req.url).searchParams;
const sortedKey = Array.from(rawParams.entries())
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => `${k}=${v}`)
  .join("&");
const cacheKey = `properties:${sortedKey || "default"}`;

const cached = await redis.get(cacheKey);
if (cached) {
  return NextResponse.json(cached);
}
```

Then, **after** the `return NextResponse.json({ properties, total, page, pages })` line (i.e., after computing the result but before returning), add the cache-write. Restructure the try block so you can cache before returning:

Replace the existing try block:

```typescript
try {
  const [properties, total] = await Promise.all([
    prisma.property.findMany({ /* ... */ }),
    prisma.property.count({ where }),
  ]);

  const result = { properties, total, page, pages: Math.ceil(total / limit) };

  // Cache for 5 minutes (fire-and-forget — don't fail if Redis is down)
  redis.setex(cacheKey, 300, result).catch(console.error);

  return NextResponse.json(result);
} catch (err) {
  console.error("[properties] DB error:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
```

- [ ] **Step 4: Verify caching works**

With dev server running, open `http://localhost:3000/api/properties` twice. Check the Railway logs or add a temporary `console.log("cache miss")` before the Prisma query — the second request should not log it.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lib/redis.ts apps/web/src/app/api/properties/route.ts
git commit -m "feat: add Redis caching to property search API (5-min TTL)"
```

---

## Task 6: Rate Limiting on Public Forms + Zod on Saved Searches

Two small hardening changes: rate limit `POST /api/leads` (the most exposed public endpoint), and add Zod validation to `POST /api/saved-searches` (currently uses unvalidated raw JSON).

**Files:**
- Create: `apps/web/src/lib/rate-limit.ts`
- Modify: `apps/web/src/app/api/leads/route.ts`
- Modify: `apps/web/src/app/api/saved-searches/route.ts`

- [ ] **Step 1: Install Upstash Ratelimit**

```powershell
cd C:\Users\hey_r\Desktop\CnC-Realty
pnpm add --filter web @upstash/ratelimit
```

- [ ] **Step 2: Create rate limit helper**

Create `apps/web/src/lib/rate-limit.ts`:

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

export const publicFormRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "ratelimit:public",
});
```

10 requests per minute per IP. Sliding window means the window moves continuously, not on fixed 60s blocks.

- [ ] **Step 3: Apply rate limiting to POST /api/leads**

In `apps/web/src/app/api/leads/route.ts`, add this import at the top:

```typescript
import { publicFormRateLimit } from "@/lib/rate-limit";
```

Then add this block as the **very first thing** inside the `POST` handler function body (before `const body = await req.json()`):

```typescript
const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anonymous";
const { success, reset } = await publicFormRateLimit.limit(ip);
if (!success) {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) },
    }
  );
}
```

- [ ] **Step 4: Add Zod validation to POST /api/saved-searches**

In `apps/web/src/app/api/saved-searches/route.ts`, add this import at the top (Zod is already installed):

```typescript
import { z } from "zod";
```

Add this schema definition before the `GET` function:

```typescript
const savedSearchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  minBeds: z.number().int().min(0).max(10).optional(),
  minBaths: z.number().min(0).max(10).optional(),
  propertyType: z.string().max(50).optional(),
  cities: z.array(z.string().max(100)).max(20).optional(),
  zips: z.array(z.string().max(10)).max(20).optional(),
  alertsOn: z.boolean().optional(),
});
```

In the `POST` handler, replace the `try { body = await req.json() } catch { ... }` block and the manual `data:` object with:

```typescript
let rawBody: unknown;
try {
  rawBody = await req.json();
} catch {
  return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
}

const parsed = savedSearchSchema.safeParse(rawBody);
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
}
const body = parsed.data;
```

Then use `body.name`, `body.minPrice`, etc. directly in the `prisma.savedSearch.create` call (same field names as before).

- [ ] **Step 5: Verify rate limit works manually**

With dev server running, run this in PowerShell to fire 11 requests in a row:

```powershell
1..11 | ForEach-Object {
  $r = Invoke-RestMethod -Uri "http://localhost:3000/api/leads" -Method POST -ContentType "application/json" -Body '{"firstName":"Test","lastName":"User","email":"test@example.com","source":"WEBSITE"}' -SkipHttpErrorCheck
  Write-Output "$_ : $($r | ConvertTo-Json -Compress)"
}
```

Expected: requests 1–10 succeed (201), request 11 returns `{"error":"Too many requests..."}`.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/lib/rate-limit.ts apps/web/src/app/api/leads/route.ts apps/web/src/app/api/saved-searches/route.ts
git commit -m "feat: add rate limiting to leads endpoint and Zod validation to saved-searches"
```

---

## Task 7: Sentry Error Monitoring

Catches unhandled errors in production on both client and server, with stack traces sent to Sentry's dashboard.

**Files:**
- Create: `apps/web/sentry.client.config.ts`
- Create: `apps/web/sentry.server.config.ts`
- Create: `apps/web/sentry.edge.config.ts`
- Modify: `apps/web/next.config.mjs`

**Prerequisite:** `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_AUTH_TOKEN` must be in `.env.local` before this task.

- [ ] **Step 1: Install @sentry/nextjs**

```powershell
cd C:\Users\hey_r\Desktop\CnC-Realty
pnpm add --filter web @sentry/nextjs
```

- [ ] **Step 2: Create sentry.client.config.ts**

Create `apps/web/sentry.client.config.ts`:

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
});
```

- [ ] **Step 3: Create sentry.server.config.ts**

Create `apps/web/sentry.server.config.ts`:

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});
```

- [ ] **Step 4: Create sentry.edge.config.ts**

Create `apps/web/sentry.edge.config.ts`:

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});
```

- [ ] **Step 5: Wrap next.config.mjs with withSentryConfig**

Replace the entire contents of `apps/web/next.config.mjs` with:

```javascript
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});
```

Add `SENTRY_ORG` and `SENTRY_PROJECT` to `.env.local`:
- `SENTRY_ORG` — your Sentry org slug (found in Sentry → Settings → Organization)
- `SENTRY_PROJECT` — your Sentry project slug (found in Sentry → Settings → Projects)

- [ ] **Step 6: Verify build passes**

```powershell
cd C:\Users\hey_r\Desktop\CnC-Realty
pnpm --filter web build
```

Expected: build completes. Sentry may print a warning about missing auth token if `SENTRY_AUTH_TOKEN` is not yet set — that's OK for local dev; it's only needed during deploy.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/sentry.client.config.ts apps/web/sentry.server.config.ts apps/web/sentry.edge.config.ts apps/web/next.config.mjs
git commit -m "feat: add Sentry error monitoring (client + server + edge)"
```

---

## Task 8: PostHog Analytics

Tracks page views and user interactions across the site. All tracking is privacy-first (`person_profiles: "identified_only"` means anonymous visitors are not profiled).

**Files:**
- Modify: `apps/web/src/components/Providers.tsx`

**Prerequisite:** `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` must be in `.env.local` before this task.

- [ ] **Step 1: Install posthog-js**

```powershell
cd C:\Users\hey_r\Desktop\CnC-Realty
pnpm add --filter web posthog-js
```

- [ ] **Step 2: Update Providers.tsx**

Replace the entire contents of `apps/web/src/components/Providers.tsx` with:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

function PostHogPageView() {
  const pathname = usePathname();
  useEffect(() => {
    posthog.capture("$pageview");
  }, [pathname]);
  return null;
}

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        person_profiles: "identified_only",
        capture_pageview: false,
      });
    }
  }, []);

  return (
    <PostHogProvider client={posthog}>
      <SessionProvider session={session}>
        <QueryClientProvider client={queryClient}>
          <PostHogPageView />
          {children}
        </QueryClientProvider>
      </SessionProvider>
    </PostHogProvider>
  );
}
```

`PostHogPageView` captures a `$pageview` event whenever `pathname` changes — this handles client-side navigation correctly in Next.js App Router.

- [ ] **Step 3: Verify no build errors**

```powershell
pnpm --filter web build
```

- [ ] **Step 4: Verify events appear in PostHog (optional, requires PostHog account)**

With dev server running and `NEXT_PUBLIC_POSTHOG_KEY` set, navigate to a few pages, then check PostHog → Activity → Live Events. You should see `$pageview` events.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/components/Providers.tsx
git commit -m "feat: add PostHog analytics with per-route pageview tracking"
```

---

## Task 9: CCPA Cookie Consent Banner

Adds a cookie consent banner required for CCPA compliance. PostHog analytics only initializes after the user accepts. A "Do Not Sell or Share My Personal Information" link in the footer lets users re-open the banner at any time.

**Files:**
- Create: `apps/web/src/hooks/useCookieConsent.ts`
- Create: `apps/web/src/components/ui/CookieBanner.tsx`
- Modify: `apps/web/src/components/Providers.tsx` — gate PostHog on consent
- Modify: `apps/web/src/app/layout.tsx` — mount `<CookieBanner />`
- Modify: `apps/web/src/components/layout/Footer.tsx` — add "Do Not Sell" link

- [ ] **Step 1: Create the consent hook**

Create `apps/web/src/hooks/useCookieConsent.ts`:

```typescript
"use client";

import { useState, useEffect } from "react";

type ConsentState = "accepted" | "declined" | null;

const COOKIE_NAME = "cnc_cookie_consent";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readCookie(): ConsentState {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  const val = match ? decodeURIComponent(match[1]) : null;
  if (val === "accepted" || val === "declined") return val;
  return null;
}

function writeCookie(value: "accepted" | "declined") {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentState>(null);
  const [bannerOpen, setBannerOpen] = useState(false);

  useEffect(() => {
    const stored = readCookie();
    setConsent(stored);
    if (!stored) setBannerOpen(true);
  }, []);

  const accept = () => {
    writeCookie("accepted");
    setConsent("accepted");
    setBannerOpen(false);
  };

  const decline = () => {
    writeCookie("declined");
    setConsent("declined");
    setBannerOpen(false);
  };

  const openBanner = () => setBannerOpen(true);

  return { consent, bannerOpen, accept, decline, openBanner };
}
```

- [ ] **Step 2: Create the CookieBanner component**

Create `apps/web/src/components/ui/CookieBanner.tsx`:

```tsx
"use client";

import { motion, AnimatePresence } from "motion/react";
import { useCookieConsent } from "@/hooks/useCookieConsent";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

export function CookieBanner() {
  const { bannerOpen, accept, decline } = useCookieConsent();

  return (
    <AnimatePresence>
      {bannerOpen && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed bottom-6 left-6 right-6 z-[9999] mx-auto max-w-xl rounded-2xl bg-[#1B1B1B] p-6 shadow-2xl md:left-auto md:right-6 md:max-w-sm"
        >
          <p className="mb-1 font-sans text-sm font-medium text-white">
            Cookie Preferences
          </p>
          <p className="mb-5 font-sans text-xs leading-relaxed text-white/60">
            We use cookies to analyze site traffic via PostHog. Under the CCPA, you have the right to opt out of the sharing of your personal information.{" "}
            <a href="/privacy" className="underline text-white/80 hover:text-white transition-colors">
              Privacy Policy
            </a>
          </p>
          <div className="flex gap-3">
            <motion.button
              onClick={accept}
              animate={PULSE_ANIMATE}
              transition={PULSE_TRANSITION}
              whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
              className="flex-1 rounded-full bg-[#9E8C61] px-4 py-2 font-sans text-xs font-medium text-white"
            >
              Accept
            </motion.button>
            <motion.button
              onClick={decline}
              whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
              className="flex-1 rounded-full border border-white/20 px-4 py-2 font-sans text-xs font-medium text-white/70 hover:text-white transition-colors"
            >
              Decline
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: Gate PostHog on consent in Providers.tsx**

In `apps/web/src/components/Providers.tsx`, import the hook and only call `posthog.init` when consent is `"accepted"`:

```tsx
import { useCookieConsent } from "@/hooks/useCookieConsent";

// Inside the Providers component, replace the existing posthog useEffect with:
const { consent } = useCookieConsent();

useEffect(() => {
  if (consent === "accepted" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: false,
    });
  }
  if (consent === "declined") {
    posthog.opt_out_capturing();
  }
}, [consent]);
```

- [ ] **Step 4: Mount CookieBanner in root layout**

In `apps/web/src/app/layout.tsx`, import and add `<CookieBanner />` inside `<Providers>`, just before `{children}`:

```tsx
import { CookieBanner } from "@/components/ui/CookieBanner";

// Inside the Providers wrapper:
<Providers session={session}>
  <CookieBanner />
  {children}
</Providers>
```

- [ ] **Step 5: Add "Do Not Sell" link to Footer**

In `apps/web/src/components/layout/Footer.tsx`, find the legal bar row (the one with "CA DRE #02439028") and add the CCPA link. Import `useCookieConsent` and wire the `openBanner` callback:

```tsx
// At the top of the Footer component function:
const { openBanner } = useCookieConsent();

// In the legal bar, after the existing links:
<button
  onClick={openBanner}
  className="hover:text-white/70 transition-colors underline"
>
  Do Not Sell or Share My Personal Information
</button>
```

- [ ] **Step 6: Verify in browser**

With dev server running:
1. Open `http://localhost:3000` in an incognito window — banner should appear at bottom-right
2. Click "Decline" — banner disappears, PostHog does NOT initialize
3. Reload — banner should NOT reappear (cookie is set)
4. Scroll to footer, click "Do Not Sell or Share My Personal Information" — banner reopens
5. Click "Accept" — banner disappears, PostHog initializes
6. Check `document.cookie` in DevTools console — should show `cnc_cookie_consent=accepted`

- [ ] **Step 7: Commit**

```powershell
git add apps/web/src/hooks/useCookieConsent.ts apps/web/src/components/ui/CookieBanner.tsx apps/web/src/components/Providers.tsx apps/web/src/app/layout.tsx apps/web/src/components/layout/Footer.tsx
git commit -m "feat: add CCPA cookie consent banner with PostHog gating and Do Not Sell footer link"
```

---

## Task 10: Pre-Deploy Environment Variable Audit

Compile every env var the app needs. Set them all in Vercel before deploying.

**No code changes.** This is a checklist/verification task.

- [ ] **Step 1: Confirm all env vars exist in apps/web/.env.local**

Open `apps/web/.env.local` and verify each of these is present and non-empty:

```
DATABASE_URL                    # Railway PostgreSQL connection string
NEXTAUTH_SECRET                 # Random 32-char string (openssl rand -base64 32)
NEXTAUTH_URL                    # https://cncrealtygroup.com (production URL)
GOOGLE_CLIENT_ID                # Google OAuth client ID
GOOGLE_CLIENT_SECRET            # Google OAuth client secret
CRMLS_CLIENT_ID                 # Trestle RESO API client ID
CRMLS_CLIENT_SECRET             # Trestle RESO API client secret
IDX_SYNC_SECRET                 # Bearer token for /api/idx/sync
SENDGRID_API_KEY                # SendGrid API key
SENDGRID_WEBHOOK_PUBLIC_KEY     # SendGrid webhook verification key
MAPBOX_TOKEN / NEXT_PUBLIC_MAPBOX_TOKEN
UPSTASH_REDIS_REST_URL          # Upstash Redis REST URL
UPSTASH_REDIS_REST_TOKEN        # Upstash Redis REST token
NEXT_PUBLIC_SENTRY_DSN          # Sentry DSN
SENTRY_AUTH_TOKEN               # Sentry auth token (for source map upload)
SENTRY_ORG                      # Sentry org slug
SENTRY_PROJECT                  # Sentry project slug
NEXT_PUBLIC_POSTHOG_KEY         # PostHog API key
NEXT_PUBLIC_POSTHOG_HOST        # e.g. https://us.i.posthog.com
```

- [ ] **Step 2: Set all env vars in Vercel**

Go to vercel.com → Project → Settings → Environment Variables. Add each variable from the list above. For variables with `NEXT_PUBLIC_` prefix, set them for Production + Preview + Development environments. For secrets (keys, tokens), Production only.

**Critical:** Set `NEXTAUTH_URL` to `https://cncrealtygroup.com` (not localhost).

- [ ] **Step 3: Verify Railway production database is accessible**

In Railway dashboard, confirm the Postgres service is running (green). Copy the production `DATABASE_URL` and confirm it's different from your local dev URL (it should be a `railway.app` hostname, not `localhost`).

- [ ] **Step 4: Add domain to Vercel**

In Vercel → Project → Settings → Domains, add `cncrealtygroup.com` and `www.cncrealtygroup.com`. Vercel will show you DNS records to add. In Hostinger DNS:
- Add `A` record: `@` → Vercel's IP (shown in Vercel dashboard)
- Add `CNAME` record: `www` → `cname.vercel-dns.com`

DNS propagation takes up to 24 hours but usually completes in minutes.

---

## Task 11: Deploy to Production

Final deploy gate. Run the full build locally first, then deploy via Vercel CLI.

**Files:**
- No code changes. Verification only.

- [ ] **Step 1: Run the production build locally**

```powershell
cd C:\Users\hey_r\Desktop\CnC-Realty
pnpm --filter web build
```

Expected: exits with code 0. Fix any TypeScript errors before proceeding.

- [ ] **Step 2: Run all tests**

```powershell
pnpm --filter web test
```

Expected: all tests pass.

- [ ] **Step 3: Run the pending database migration on Railway**

The production Railway DB must have all migrations applied. Connect to Railway's shell or use Prisma CLI with the production DATABASE_URL:

```powershell
$env:DATABASE_URL = "<your-production-railway-postgres-url>"
pnpm --filter @cnc/database exec prisma migrate deploy
```

Expected output ends with: `All migrations have been successfully applied.`

- [ ] **Step 4: Push branch and deploy via Vercel**

```powershell
git push origin claude/real-estate-website-9bdWi
```

Then in Vercel dashboard → Deployments, trigger a deploy from this branch. Or install Vercel CLI and deploy directly:

```powershell
cd apps/web
npx vercel --prod
```

- [ ] **Step 5: Smoke-test production**

After deploy completes, verify:
1. `https://cncrealtygroup.com` — homepage loads, hero video plays
2. `https://cncrealtygroup.com/properties` — listings appear
3. `https://cncrealtygroup.com/properties/<any-mls-number>` — detail page with JSON-LD in source
4. `https://cncrealtygroup.com/sitemap.xml` — returns XML
5. `https://cncrealtygroup.com/robots.txt` — returns disallow rules
6. `https://cncrealtygroup.com/contact` — submit form → confirm lead appears in Railway DB
7. `https://cncrealtygroup.com/login` — sign in works, session persists

- [ ] **Step 6: Verify Sentry receives an error**

In Sentry dashboard → Issues, you should see issues appear within a few minutes of production traffic. If you want to test manually, temporarily throw an error in a server component and deploy — Sentry will catch it.

- [ ] **Step 7: Final commit (tag the release)**

```powershell
git tag v1.0.0
git push origin v1.0.0
```

---

## Self-Review

**Spec coverage check:**

| Phase 6 Item | Task | Status |
|---|---|---|
| ISR on property pages | Task 1 | ✅ |
| Skeleton loaders | Task 2 | ✅ |
| Sitemap + robots.txt | Task 3 | ✅ |
| JSON-LD structured data | Task 4 | ✅ |
| Redis caching for search | Task 5 | ✅ |
| Rate limiting on public forms | Task 6 | ✅ |
| Zod validation (remaining routes) | Task 6 | ✅ (`saved-searches`) |
| Sentry error monitoring | Task 7 | ✅ |
| PostHog analytics | Task 8 | ✅ |
| CCPA cookie consent banner | Task 9 | ✅ |
| Env var audit + Vercel setup | Task 10 | ✅ |
| Deploy to Vercel + Railway | Task 11 | ✅ |
| Contact page | — | Already built in Phase 2/5 ✅ |
| `/api/leads` Zod | — | Already in place ✅ |
| Drip execution engine | — | Deferred post-launch (backlog) |

**Not in this plan (deferred):**
- Drip execution engine (cron that reads DripStep records and sends emails at scheduled delays) — build after launch when email infra is validated
- CSRF protection — NextAuth already handles CSRF for auth routes; public forms use JSON (not form submissions), so CSRF is not applicable
- GA4 — PostHog covers analytics; GA4 can be added later via PostHog's GA integration if needed
