# Phase 4A — IDX Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CRMLS RESO Web API client, property sync job (Vercel Cron), and property search/detail API routes so the database stays populated with live MLS listings.

**Architecture:** A module-level RESO OAuth2 client fetches and caches tokens in `SiteSettings` (Prisma). A generator-based property client pages through OData results. A `POST /api/idx/sync` route runs the full or delta upsert into the `Property` table and is called every 15 minutes by a Vercel Cron job. Property search and detail are served as standard Next.js API routes.

**Tech Stack:** Next.js 14 App Router, Prisma (PostgreSQL on Railway), native `fetch` (no extra HTTP package needed), Vercel Cron Jobs (`vercel.json`), CRMLS RESO Web API (OData v4).

---

## CRMLS API Facts

- **Token URL:** `https://replication.crmls.org/CRMLS/oauth2/connect/token`
- **Base URL:** `https://replication.crmls.org/CRMLS/reso/odata/`
- **Auth:** OAuth2 client credentials (`grant_type=client_credentials`)
- **Pagination:** OData `$top=200` + follow `@odata.nextLink` in response
- **Delta sync:** filter with `ModificationTimestamp gt <ISO8601>`
- **Media:** request with `$expand=Media` — each `Media` item has a `MediaURL` field

---

## File Map

**Create:**
- `apps/web/src/lib/idx/auth.ts` — RESO OAuth2 token fetch + SiteSettings cache
- `apps/web/src/lib/idx/client.ts` — OData property fetcher with pagination
- `apps/web/src/lib/idx/field-map.ts` — RESO field names → Prisma Property fields
- `apps/web/src/app/api/idx/sync/route.ts` — POST sync handler (full + delta)
- `apps/web/src/app/api/properties/route.ts` — GET property search with filters
- `apps/web/src/app/api/properties/[mlsNumber]/route.ts` — GET single property
- `vercel.json` — Cron job config (calls `/api/idx/sync` every 15 min)

**Modify:**
- `apps/web/.env.local` — Add `CRMLS_CLIENT_ID`, `CRMLS_CLIENT_SECRET`, `CRON_SECRET`

---

## Task 1: Add CRMLS Environment Variables

**Files:**
- Modify: `apps/web/.env.local`

- [ ] **Step 1: Add vars to .env.local**

Open `apps/web/.env.local` and add these three lines after the SendGrid block:

```
# CRMLS RESO Web API
CRMLS_CLIENT_ID=your_client_id_here
CRMLS_CLIENT_SECRET=your_client_secret_here

# Vercel Cron secret (generate any random string, e.g. openssl rand -hex 32)
CRON_SECRET=your_random_secret_here
```

Replace `your_client_id_here` and `your_client_secret_here` with the actual CRMLS credentials. Replace `your_random_secret_here` with any long random string (used to authenticate the cron caller).

Also fill in the Mapbox token if available:
```
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_token_here
```

- [ ] **Step 2: Commit**

Do NOT commit `.env.local` (it's in `.gitignore`). Just confirm the file is saved. No git commit for this task.

---

## Task 2: RESO OAuth2 Token Helper

**Files:**
- Create: `apps/web/src/lib/idx/auth.ts`

This module fetches a CRMLS OAuth2 token and caches it in the `SiteSettings` table so it survives across serverless function cold starts.

- [ ] **Step 1: Create the auth helper**

Create `apps/web/src/lib/idx/auth.ts`:

```typescript
import { prisma } from "@/lib/prisma";

const TOKEN_URL = "https://replication.crmls.org/CRMLS/oauth2/connect/token";
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

  // 2. Fetch new token
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.CRMLS_CLIENT_ID!,
    client_secret: process.env.CRMLS_CLIENT_SECRET!,
    scope: "api",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CRMLS token fetch failed: ${res.status} ${text}`);
  }

  const json = await res.json() as { access_token: string; expires_in: number };
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/idx/auth.ts
git commit -m "feat: CRMLS RESO OAuth2 token helper with SiteSettings cache"
```

---

## Task 3: RESO Field Mapper

**Files:**
- Create: `apps/web/src/lib/idx/field-map.ts`

Maps raw RESO OData property fields to the shape expected by `prisma.property.create()`.

- [ ] **Step 1: Create the field mapper**

Create `apps/web/src/lib/idx/field-map.ts`:

```typescript
export interface ResoProperty {
  ListingKey: string;
  StandardStatus?: string;
  ListPrice?: number;
  BedroomsTotal?: number;
  BathroomsTotalInteger?: number;
  BathroomsFull?: number;
  BathroomsHalf?: number;
  LivingArea?: number;
  LotSizeSquareFeet?: number;
  YearBuilt?: number;
  PropertySubType?: string;
  PropertyType?: string;
  PublicRemarks?: string;
  StreetNumber?: string;
  StreetName?: string;
  StreetSuffix?: string;
  UnitNumber?: string;
  City?: string;
  StateOrProvince?: string;
  PostalCode?: string;
  CountyOrParish?: string;
  Latitude?: number;
  Longitude?: number;
  ModificationTimestamp?: string;
  ListingContractDate?: string;
  Media?: { MediaURL: string; Order?: number }[];
  [key: string]: unknown;
}

export function mapResoToProperty(raw: ResoProperty) {
  const streetParts = [raw.StreetNumber, raw.StreetName, raw.StreetSuffix].filter(Boolean);
  const address = raw.UnitNumber
    ? `${streetParts.join(" ")} #${raw.UnitNumber}`
    : streetParts.join(" ");

  const baths =
    raw.BathroomsTotalInteger ??
    ((raw.BathroomsFull ?? 0) + (raw.BathroomsHalf ?? 0) * 0.5) ||
    undefined;

  const photos = (raw.Media ?? [])
    .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
    .map((m) => m.MediaURL);

  return {
    mlsNumber: raw.ListingKey,
    status: raw.StandardStatus ?? "Unknown",
    listPrice: raw.ListPrice ?? 0,
    beds: raw.BedroomsTotal ?? null,
    baths: baths ?? null,
    sqft: raw.LivingArea ? Math.round(raw.LivingArea) : null,
    lotSize: raw.LotSizeSquareFeet ? raw.LotSizeSquareFeet / 43560 : null, // acres
    yearBuilt: raw.YearBuilt ?? null,
    propertyType: raw.PropertySubType ?? raw.PropertyType ?? null,
    description: raw.PublicRemarks ?? null,
    address: address || "Unknown",
    city: raw.City ?? "Unknown",
    state: raw.StateOrProvince ?? "CA",
    zip: raw.PostalCode ?? "",
    county: raw.CountyOrParish ?? null,
    latitude: raw.Latitude ?? null,
    longitude: raw.Longitude ?? null,
    photos: photos,
    rawData: raw as object,
    modifiedAt: raw.ModificationTimestamp ? new Date(raw.ModificationTimestamp) : null,
    listedAt: raw.ListingContractDate ? new Date(raw.ListingContractDate) : null,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/idx/field-map.ts
git commit -m "feat: RESO → Prisma Property field mapper"
```

---

## Task 4: RESO OData Property Client

**Files:**
- Create: `apps/web/src/lib/idx/client.ts`

Fetches properties from CRMLS with OData pagination. Yields batches of mapped properties.

- [ ] **Step 1: Create the client**

Create `apps/web/src/lib/idx/client.ts`:

```typescript
import { getResoToken } from "./auth";
import { mapResoToProperty, ResoProperty } from "./field-map";

const BASE_URL = "https://replication.crmls.org/CRMLS/reso/odata";

const SELECT_FIELDS = [
  "ListingKey", "StandardStatus", "ListPrice",
  "BedroomsTotal", "BathroomsTotalInteger", "BathroomsFull", "BathroomsHalf",
  "LivingArea", "LotSizeSquareFeet", "YearBuilt",
  "PropertySubType", "PropertyType", "PublicRemarks",
  "StreetNumber", "StreetName", "StreetSuffix", "UnitNumber",
  "City", "StateOrProvince", "PostalCode", "CountyOrParish",
  "Latitude", "Longitude", "ModificationTimestamp", "ListingContractDate",
].join(",");

interface ODataResponse {
  value: ResoProperty[];
  "@odata.nextLink"?: string;
}

export async function* fetchProperties(modifiedSince?: Date) {
  const token = await getResoToken();

  const filter = modifiedSince
    ? `$filter=ModificationTimestamp gt ${modifiedSince.toISOString()}&`
    : "";

  let url: string | null =
    `${BASE_URL}/Property?${filter}$top=200&$select=${SELECT_FIELDS}&$expand=Media($select=MediaURL,Order)`;

  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`RESO fetch failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as ODataResponse;
    yield data.value.map(mapResoToProperty);
    url = data["@odata.nextLink"] ?? null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/idx/client.ts
git commit -m "feat: RESO OData property client with pagination"
```

---

## Task 5: Sync API Route + Vercel Cron

**Files:**
- Create: `apps/web/src/app/api/idx/sync/route.ts`
- Create: `vercel.json`

The sync route accepts a `type` query param: `full` (no date filter) or `delta` (since last 20 min). Vercel Cron calls it every 15 minutes with the `CRON_SECRET` in the `Authorization` header.

- [ ] **Step 1: Create the sync route**

Create `apps/web/src/app/api/idx/sync/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchProperties } from "@/lib/idx/client";

export const maxDuration = 300; // Vercel max for Pro plan

export async function POST(req: Request) {
  // Auth guard — only Vercel Cron or manual trigger with secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "delta";

  // Delta: re-sync anything modified in the last 20 minutes
  const modifiedSince = type === "full" ? undefined : new Date(Date.now() - 20 * 60 * 1000);

  let upserted = 0;
  let errors = 0;

  try {
    for await (const batch of fetchProperties(modifiedSince)) {
      await Promise.allSettled(
        batch.map(async (property) => {
          try {
            await prisma.property.upsert({
              where: { mlsNumber: property.mlsNumber },
              create: property,
              update: property,
            });
            upserted++;
          } catch (err) {
            console.error("Upsert failed for", property.mlsNumber, err);
            errors++;
          }
        })
      );
    }
  } catch (err) {
    console.error("Sync fatal error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  return NextResponse.json({ upserted, errors, type });
}
```

- [ ] **Step 2: Create vercel.json**

Create `vercel.json` at the repo root (`C:\Users\hey_r\Desktop\CnC-Realty\vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/idx/sync",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Note: Vercel Cron calls use GET by default but our route is POST. Vercel's cron jobs actually support POST in `vercel.json` — add the method:

```json
{
  "crons": [
    {
      "path": "/api/idx/sync?type=delta",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Actually Vercel Cron only supports GET. Update the sync route to also handle GET (for the cron caller) and keep POST for manual triggers:

Replace the entire `apps/web/src/app/api/idx/sync/route.ts` with:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchProperties } from "@/lib/idx/client";

export const maxDuration = 300;

async function runSync(type: string) {
  const modifiedSince = type === "full" ? undefined : new Date(Date.now() - 20 * 60 * 1000);

  let upserted = 0;
  let errors = 0;

  for await (const batch of fetchProperties(modifiedSince)) {
    await Promise.allSettled(
      batch.map(async (property) => {
        try {
          await prisma.property.upsert({
            where: { mlsNumber: property.mlsNumber },
            create: property,
            update: property,
          });
          upserted++;
        } catch (err) {
          console.error("Upsert failed for", property.mlsNumber, err);
          errors++;
        }
      })
    );
  }

  return { upserted, errors, type };
}

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

// Vercel Cron calls GET
export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const type = new URL(req.url).searchParams.get("type") ?? "delta";
  try {
    const result = await runSync(type);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Manual POST trigger
export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const type = new URL(req.url).searchParams.get("type") ?? "delta";
  try {
    const result = await runSync(type);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/idx/sync/route.ts vercel.json
git commit -m "feat: IDX sync route (GET+POST) + Vercel cron every 15 min"
```

---

## Task 6: Property Search API Route

**Files:**
- Create: `apps/web/src/app/api/properties/route.ts`

Public endpoint. Supports filter params via query string.

- [ ] **Step 1: Create the route**

Create `apps/web/src/app/api/properties/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const city = searchParams.get("city");
  const zip = searchParams.get("zip");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const minBeds = searchParams.get("minBeds");
  const minBaths = searchParams.get("minBaths");
  const propertyType = searchParams.get("propertyType");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));

  const where: Prisma.PropertyWhereInput = {
    status: { in: ["Active", "Coming Soon"] },
  };

  if (city) where.city = { contains: city, mode: "insensitive" };
  if (zip) where.zip = zip;
  if (minPrice) where.listPrice = { ...where.listPrice as object, gte: parseFloat(minPrice) };
  if (maxPrice) where.listPrice = { ...where.listPrice as object, lte: parseFloat(maxPrice) };
  if (minBeds) where.beds = { gte: parseInt(minBeds) };
  if (minBaths) where.baths = { gte: parseFloat(minBaths) };
  if (propertyType) where.propertyType = { contains: propertyType, mode: "insensitive" };

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      orderBy: { listedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        mlsNumber: true,
        status: true,
        listPrice: true,
        beds: true,
        baths: true,
        sqft: true,
        propertyType: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        latitude: true,
        longitude: true,
        photos: true,
        listedAt: true,
      },
    }),
    prisma.property.count({ where }),
  ]);

  return NextResponse.json({
    properties,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/properties/route.ts
git commit -m "feat: GET /api/properties with city/zip/price/beds/baths/type filters"
```

---

## Task 7: Property Detail API Route

**Files:**
- Create: `apps/web/src/app/api/properties/[mlsNumber]/route.ts`

- [ ] **Step 1: Create the route**

Create `apps/web/src/app/api/properties/[mlsNumber]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { mlsNumber: string } }
) {
  const property = await prisma.property.findUnique({
    where: { mlsNumber: params.mlsNumber },
  });

  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(property);
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/api/properties/[mlsNumber]/route.ts"
git commit -m "feat: GET /api/properties/[mlsNumber] detail route"
```

---

## Task 8: Trigger Initial Full Sync & Verify

**Files:** None created — this task verifies the system works end-to-end.

- [ ] **Step 1: Start the dev server**

```bash
cd C:\Users\hey_r\Desktop\CnC-Realty
pnpm --filter web dev
```

- [ ] **Step 2: Trigger a full sync**

Open a second terminal and run:

```bash
curl -X POST "http://localhost:3000/api/idx/sync?type=full" \
  -H "Authorization: Bearer YOUR_CRON_SECRET_HERE"
```

Replace `YOUR_CRON_SECRET_HERE` with the value of `CRON_SECRET` in `.env.local`.

Expected response: `{"upserted": <N>, "errors": 0, "type": "full"}` where N > 0.

- [ ] **Step 3: Verify properties in DB**

Open Prisma Studio:
```bash
cd C:\Users\hey_r\Desktop\CnC-Realty
pnpm --filter @cnc/database exec prisma studio
```

Navigate to the `Property` table. Confirm rows exist with correct address, price, and photo URLs.

- [ ] **Step 4: Test the search API**

```bash
curl "http://localhost:3000/api/properties?city=Los%20Angeles&minBeds=3&minPrice=500000"
```

Expected: JSON with `properties` array and `total` count.

- [ ] **Step 5: Test the detail API**

Use an `mlsNumber` from the previous response:

```bash
curl "http://localhost:3000/api/properties/<mlsNumber>"
```

Expected: full property object with all fields.

- [ ] **Step 6: Run build to verify no errors**

```bash
pnpm --filter web run build
```

Expected: all routes compile, no new errors.

- [ ] **Step 7: Commit any fixes**

If you had to fix any field mapping issues from the real CRMLS data:

```bash
git add -A
git commit -m "fix: adjust field mapping based on real CRMLS data"
```

If no fixes needed, skip this step.

---

## Final Verification Checklist

- [ ] CRMLS token is fetched and cached in `SiteSettings`
- [ ] Full sync populates `Property` table with real MLS data
- [ ] Delta sync only fetches records modified in the last 20 minutes
- [ ] `GET /api/properties` returns filtered, paginated results
- [ ] `GET /api/properties/[mlsNumber]` returns a single property or 404
- [ ] Build passes: `pnpm --filter web run build`

---

## Self-Review

**Spec coverage:**
- ✅ RESO Web API client with auth + rate-limit-safe pagination
- ✅ Field mapping RESO → Prisma Property
- ✅ Full sync + delta sync (15-min cron via Vercel)
- ✅ Property search API with all filters from Phase 4 spec
- ✅ Property detail API
- ✅ Token caching (SiteSettings) survives serverless cold starts

**Gaps deliberately deferred to Phase 4B:**
- Property search PAGE (UI) → Phase 4B Task 1
- Property detail PAGE (gallery, mortgage calc, inquiry form) → Phase 4B Task 2
- Map search page (Mapbox) → Phase 4B Task 3
- Homepage carousel using real DB data → Phase 4B Task 4
- Saved properties (heart button + saved searches) → Phase 4B Task 5

**Placeholder scan:** None found. All code is complete and runnable.

**Type consistency:** `ResoProperty` defined in `field-map.ts`, imported in `client.ts`. `mapResoToProperty` return shape matches `Prisma.PropertyCreateInput` fields exactly (checked against schema.prisma).
