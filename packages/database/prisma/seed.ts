import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RESIDENTIAL_SALE_BUYER_ITEMS = [
  { name: "Purchase Agreement", description: "Fully executed purchase contract", isRequired: true, order: 1 },
  { name: "Pre-Approval Letter", description: "Lender pre-approval dated within 30 days", isRequired: true, order: 2 },
  { name: "Buyer's Agency Agreement", description: "Signed buyer representation agreement", isRequired: true, order: 3 },
  { name: "Disclosure Package Acknowledgement", description: "Signed seller disclosure receipt", isRequired: true, order: 4 },
  { name: "Inspection Reports", description: "Home, pest, and any other inspections", isRequired: false, order: 5 },
  { name: "Loan Commitment Letter", description: "Final loan approval from lender", isRequired: true, order: 6 },
  { name: "Final Walkthrough", description: "Signed walkthrough verification form", isRequired: false, order: 7 },
  { name: "Settlement Statement / HUD-1", description: "Closing disclosure signed by all parties", isRequired: true, order: 8 },
];

const RESIDENTIAL_SALE_SELLER_ITEMS = [
  { name: "Listing Agreement", description: "Signed exclusive right-to-sell agreement", isRequired: true, order: 1 },
  { name: "Transfer Disclosure Statement (TDS)", description: "Completed seller TDS form", isRequired: true, order: 2 },
  { name: "Natural Hazard Disclosure (NHD)", description: "Natural hazard zone disclosure report", isRequired: true, order: 3 },
  { name: "Seller Property Questionnaire", description: "Completed SPQ form", isRequired: true, order: 4 },
  { name: "Purchase Agreement", description: "Fully executed purchase contract", isRequired: true, order: 5 },
  { name: "Counter Offer(s)", description: "All signed counter offer addenda", isRequired: false, order: 6 },
  { name: "Preliminary Title Report", description: "Prelim from title/escrow company", isRequired: true, order: 7 },
  { name: "Settlement Statement / HUD-1", description: "Closing disclosure signed by all parties", isRequired: true, order: 8 },
];

const RESIDENTIAL_LEASE_ITEMS = [
  { name: "Residential Lease Agreement", description: "Fully executed lease agreement", isRequired: true, order: 1 },
  { name: "Tenant Application", description: "Completed rental application", isRequired: true, order: 2 },
  { name: "Credit & Background Check", description: "Screening report for all adult tenants", isRequired: true, order: 3 },
  { name: "Proof of Income", description: "Pay stubs or bank statements (3 months)", isRequired: true, order: 4 },
  { name: "Move-In Inspection Report", description: "Signed condition checklist at move-in", isRequired: true, order: 5 },
  { name: "Security Deposit Receipt", description: "Signed receipt for deposit funds", isRequired: true, order: 6 },
  { name: "Lead-Based Paint Disclosure", description: "Required for pre-1978 properties", isRequired: false, order: 7 },
];

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

  const resSaleBuyer = await prisma.checklistTemplate.upsert({
    where: { id: "seed-res-sale-buyer" },
    update: {},
    create: {
      id: "seed-res-sale-buyer",
      name: "Residential Sale — Buyer Side",
      fileType: "TRANSACTION",
      listingType: "RESIDENTIAL_SALE",
      transactionSide: "PURCHASE",
      isActive: true,
      items: {
        create: RESIDENTIAL_SALE_BUYER_ITEMS,
      },
    },
  });

  const resSaleSeller = await prisma.checklistTemplate.upsert({
    where: { id: "seed-res-sale-seller" },
    update: {},
    create: {
      id: "seed-res-sale-seller",
      name: "Residential Sale — Seller Side",
      fileType: "TRANSACTION",
      listingType: "RESIDENTIAL_SALE",
      transactionSide: "LISTING",
      isActive: true,
      items: {
        create: RESIDENTIAL_SALE_SELLER_ITEMS,
      },
    },
  });

  const resLease = await prisma.checklistTemplate.upsert({
    where: { id: "seed-res-lease" },
    update: {},
    create: {
      id: "seed-res-lease",
      name: "Residential Lease",
      fileType: "LISTING",
      listingType: "RESIDENTIAL_LEASE",
      transactionSide: "LEASE_TENANT",
      isActive: true,
      items: {
        create: RESIDENTIAL_LEASE_ITEMS,
      },
    },
  });

  console.log(`Created templates: ${resSaleBuyer.name}, ${resSaleSeller.name}, ${resLease.name}`);

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
