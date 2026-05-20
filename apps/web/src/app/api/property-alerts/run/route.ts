import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { sendPropertyAlertEmail } from "@/lib/email/property-alert-email";

export async function POST(req: Request) {
  // Require SYNC_SECRET bearer token
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/, "");
  const secret = process.env.SYNC_SECRET;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch all saved searches that have alerts enabled, with their user
    const savedSearches = await prisma.savedSearch.findMany({
      where: { alertsOn: true },
      include: {
        user: { select: { id: true, email: true, name: true } },
        alerts: { select: { propertyId: true } },
      },
    });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Track: userId → list of (savedSearchId, property) pairs
    type NewAlert = {
      savedSearchId: string;
      property: {
        id: string;
        mlsNumber: string;
        address: string;
        city: string;
        listPrice: number;
        photos: unknown;
      };
    };
    const newAlertsByUser = new Map<string, { user: { email: string; name: string | null }; alerts: NewAlert[] }>();

    let processed = 0;

    for (const search of savedSearches) {
      processed++;

      // Build Prisma where clause from search criteria
      const where: Prisma.PropertyWhereInput = {
        status: { in: ["Active", "Coming Soon"] },
        createdAt: { gte: since },
      };

      if (search.minPrice !== null || search.maxPrice !== null) {
        const priceFilter: Prisma.FloatFilter = {};
        if (search.minPrice !== null) priceFilter.gte = search.minPrice;
        if (search.maxPrice !== null) priceFilter.lte = search.maxPrice;
        where.listPrice = priceFilter;
      }
      if (search.minBeds !== null) {
        where.beds = { gte: search.minBeds };
      }
      if (search.minBaths !== null) {
        where.baths = { gte: search.minBaths };
      }
      if (search.propertyType) {
        where.propertyType = { contains: search.propertyType, mode: "insensitive" };
      }
      if (search.cities.length > 0) {
        where.city = { in: search.cities };
      }
      if (search.zips.length > 0) {
        where.zip = { in: search.zips };
      }

      // Find matching properties created in last 24h
      const matchingProperties = await prisma.property.findMany({
        where,
        select: {
          id: true,
          mlsNumber: true,
          address: true,
          city: true,
          listPrice: true,
          photos: true,
        },
      });

      // Already-alerted property IDs for this search
      const alreadyAlerted = new Set(search.alerts.map((a) => a.propertyId));

      // Filter to new ones only
      const newProperties = matchingProperties.filter((p) => !alreadyAlerted.has(p.id));

      if (newProperties.length === 0) continue;

      // Create PropertyAlert records
      await prisma.propertyAlert.createMany({
        data: newProperties.map((p) => ({
          savedSearchId: search.id,
          propertyId: p.id,
          notifiedAt: new Date(),
        })),
        skipDuplicates: true,
      });

      // Group by user for email batching
      const userId = search.user.id;
      if (!newAlertsByUser.has(userId)) {
        newAlertsByUser.set(userId, {
          user: { email: search.user.email ?? "", name: search.user.name },
          alerts: [],
        });
      }
      newAlertsByUser.get(userId)!.alerts.push(
        ...newProperties.map((p) => ({ savedSearchId: search.id, property: p }))
      );
    }

    // Send one email per user with all new matches
    let emailsSent = 0;
    for (const [, { user, alerts }] of Array.from(newAlertsByUser)) {
      if (!user.email) continue;

      const properties = alerts.map(({ property }: NewAlert) => {
        let photoUrl: string | null = null;
        try {
          const photos = property.photos as string[];
          photoUrl = Array.isArray(photos) && photos.length > 0 ? photos[0] : null;
        } catch {
          // ignore
        }
        return {
          address: property.address,
          city: property.city,
          listPrice: property.listPrice,
          mlsNumber: property.mlsNumber,
          photoUrl,
        };
      });

      try {
        await sendPropertyAlertEmail(user.email, user.name ?? "there", properties);
        emailsSent++;
      } catch (emailErr) {
        console.error("[property-alerts] Failed to send email to", user.email, emailErr);
      }
    }

    return NextResponse.json({ processed, emailsSent });
  } catch (err) {
    console.error("[property-alerts/run] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
