import { PrismaClient } from "@prisma/client";
import { RESIDENTIAL_SALE_LISTING_ITEMS, RESIDENTIAL_SALE_BUYER_ITEMS, RESIDENTIAL_SALE_SELLER_ITEMS, RESIDENTIAL_LEASE_LISTING_ITEMS, RESIDENTIAL_LEASE_TENANT_ITEMS, RESIDENTIAL_LEASE_LANDLORD_ITEMS, DUAL_AGENCY_ITEMS, LEASE_DUAL_AGENCY_ITEMS, REFERRAL_ITEMS, COMMERCIAL_SALE_LISTING_ITEMS, COMMERCIAL_LEASE_LISTING_ITEMS, COMMERCIAL_PURCHASE_ITEMS, COMMERCIAL_LISTING_TX_ITEMS, COMMERCIAL_DUAL_ITEMS, COMMERCIAL_LEASE_TENANT_ITEMS, COMMERCIAL_LEASE_LANDLORD_ITEMS, COMMERCIAL_LEASE_DUAL_ITEMS } from "./checklist-templates";

const prisma = new PrismaClient();

const TAGS: { name: string; color: string }[] = [
  // CA Counties — slate blue
  ...[
    "Alameda","Alpine","Amador","Butte","Calaveras","Colusa","Contra Costa",
    "Del Norte","El Dorado","Fresno","Glenn","Humboldt","Imperial","Inyo",
    "Kern","Kings","Lake","Lassen","Los Angeles","Madera","Marin","Mariposa",
    "Mendocino","Merced","Modoc","Mono","Monterey","Napa","Nevada","Orange",
    "Placer","Plumas","Riverside","Sacramento","San Benito","San Bernardino",
    "San Diego","San Francisco","San Joaquin","San Luis Obispo","San Mateo",
    "Santa Barbara","Santa Clara","Santa Cruz","Shasta","Sierra","Siskiyou",
    "Solano","Sonoma","Stanislaus","Sutter","Tehama","Trinity","Tulare",
    "Tuolumne","Ventura","Yolo","Yuba",
  ].map((name) => ({ name, color: "#64748B" })),

  // Buyer type — blue
  ...["First Time Buyer","Cash Buyer","VA Loan","Investor","Relocating","Downsizing","Upsizing"]
    .map((name) => ({ name, color: "#3B82F6" })),

  // Property type — emerald
  ...["Single Family","Condo","Townhome","New Construction","Fixer Upper","Luxury"]
    .map((name) => ({ name, color: "#10B981" })),

  // Lead origin — amber
  ...["Open House","Referral","Instagram","Facebook","Zillow","Yelp"]
    .map((name) => ({ name, color: "#F59E0B" })),

  // Relationship — purple
  ...["Past Client","Family","Friend","Colleague"]
    .map((name) => ({ name, color: "#8B5CF6" })),

  // Situation flags — rose
  ...["Pre-Approved","Needs to Sell First","Divorce","Probate","Expired Listing"]
    .map((name) => ({ name, color: "#F43F5E" })),
];

async function main() {
  console.log("Seeding checklist templates...");

  async function upsertTemplate(
    id: string,
    name: string,
    fileType: "LISTING" | "TRANSACTION",
    listingType: string,
    transactionSide: string,
    propertyCategory: string,
    items: { name: string; description: string | null; isRequired: boolean; order: number; builtBefore?: number; skipWhenConverted?: boolean }[]
  ) {
    await prisma.checklistTemplateItem.deleteMany({ where: { templateId: id } });
    const rows = items.map((i) => ({ ...i, skipWhenConverted: i.skipWhenConverted ?? false }));
    return prisma.checklistTemplate.upsert({
      where: { id },
      update: { name, fileType, listingType, transactionSide, propertyCategory, items: { create: rows } },
      create: { id, name, fileType, listingType, transactionSide, propertyCategory, isActive: true, items: { create: rows } },
    });
  }

  const templates = await Promise.all([
    upsertTemplate("seed-res-sale-listing", "Residential Sale — Listing Forms (Pre-Contract)", "LISTING", "RESIDENTIAL_SALE", "ALL", "ALL", RESIDENTIAL_SALE_LISTING_ITEMS),
    upsertTemplate("seed-res-sale-buyer", "Purchase Forms", "TRANSACTION", "ALL", "PURCHASE", "RESIDENTIAL", RESIDENTIAL_SALE_BUYER_ITEMS),
    upsertTemplate("seed-res-sale-seller", "Listing Forms", "TRANSACTION", "ALL", "LISTING", "RESIDENTIAL", RESIDENTIAL_SALE_SELLER_ITEMS),
    upsertTemplate("seed-res-lease", "Residential Lease — Landlord Listing Forms (Pre-Contract)", "LISTING", "RESIDENTIAL_LEASE", "ALL", "ALL", RESIDENTIAL_LEASE_LISTING_ITEMS),
    upsertTemplate("seed-res-lease-tenant", "Lease Tenant Forms", "TRANSACTION", "ALL", "LEASE_TENANT", "RESIDENTIAL", RESIDENTIAL_LEASE_TENANT_ITEMS),
    upsertTemplate("seed-res-lease-landlord", "Lease Landlord Forms", "TRANSACTION", "ALL", "LEASE_LANDLORD", "RESIDENTIAL", RESIDENTIAL_LEASE_LANDLORD_ITEMS),
    upsertTemplate("seed-dual-agency", "Dual Agency Forms", "TRANSACTION", "ALL", "DUAL", "RESIDENTIAL", DUAL_AGENCY_ITEMS),
    upsertTemplate("seed-lease-dual-agency", "Lease Dual Agency Forms", "TRANSACTION", "ALL", "LEASE_DUAL", "RESIDENTIAL", LEASE_DUAL_AGENCY_ITEMS),
    upsertTemplate("seed-referral", "Referral Forms", "TRANSACTION", "ALL", "REFERRAL", "ALL", REFERRAL_ITEMS),
    upsertTemplate("seed-commercial-sale-listing", "Commercial Sale — Listing Forms (Pre-Contract)", "LISTING", "COMMERCIAL_SALE", "ALL", "ALL", COMMERCIAL_SALE_LISTING_ITEMS),
    upsertTemplate("seed-commercial-lease-listing", "Commercial Lease — Landlord Listing Forms (Pre-Contract)", "LISTING", "COMMERCIAL_LEASE", "ALL", "ALL", COMMERCIAL_LEASE_LISTING_ITEMS),
    upsertTemplate("seed-commercial-purchase", "Commercial Purchase Forms", "TRANSACTION", "ALL", "PURCHASE", "COMMERCIAL", COMMERCIAL_PURCHASE_ITEMS),
    upsertTemplate("seed-commercial-listing-tx", "Commercial Listing Forms", "TRANSACTION", "ALL", "LISTING", "COMMERCIAL", COMMERCIAL_LISTING_TX_ITEMS),
    upsertTemplate("seed-commercial-dual", "Commercial Dual Agency Forms", "TRANSACTION", "ALL", "DUAL", "COMMERCIAL", COMMERCIAL_DUAL_ITEMS),
    upsertTemplate("seed-commercial-lease-tenant", "Commercial Lease Tenant Forms", "TRANSACTION", "ALL", "LEASE_TENANT", "COMMERCIAL", COMMERCIAL_LEASE_TENANT_ITEMS),
    upsertTemplate("seed-commercial-lease-landlord", "Commercial Lease Landlord Forms", "TRANSACTION", "ALL", "LEASE_LANDLORD", "COMMERCIAL", COMMERCIAL_LEASE_LANDLORD_ITEMS),
    upsertTemplate("seed-commercial-lease-dual", "Commercial Lease Dual Agency Forms", "TRANSACTION", "ALL", "LEASE_DUAL", "COMMERCIAL", COMMERCIAL_LEASE_DUAL_ITEMS),
  ]);

  console.log(`Created/updated ${templates.length} checklist templates: ${templates.map((t) => t.name).join(", ")}`);

  console.log(`Seeding ${TAGS.length} tags...`);
  await Promise.all(
    TAGS.map((tag) =>
      prisma.tag.upsert({
        where: { name: tag.name },
        update: { color: tag.color },
        create: tag,
      })
    )
  );
  console.log("Tags seeded.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
