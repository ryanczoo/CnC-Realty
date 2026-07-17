import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RESIDENTIAL_SALE_LISTING_ITEMS = [
  { name: "RLA — Residential Listing Agreement (Exclusive)", description: "Signed exclusive right-to-sell listing contract", isRequired: true, order: 1 },
  { name: "AVID — Agent Visual Inspection Disclosure", description: "Agent's own visual inspection disclosure, Civil Code §2079", isRequired: true, order: 2 },
  { name: "TDS — Real Estate Transfer Disclosure Statement", description: "Seller's statutory disclosure, Civil Code §1102", isRequired: true, order: 3 },
  { name: "SPQ — Seller Property Questionnaire", description: "C.A.R. supplemental seller questionnaire", isRequired: true, order: 4 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Ordered from a third-party NHD vendor, not a C.A.R. form. Govt. Code §8589.3", isRequired: true, order: 5 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Civil Code §2079.13-2079.24", isRequired: true, order: 6 },
  { name: "DBD — Megan's Law Database Disclosure", description: "Civil Code §2079.10a", isRequired: true, order: 7 },
  { name: "WHSD — Water Heater & Smoke Detector Statement of Compliance", description: "Health & Safety Code water heater bracing + smoke/CO detector compliance", isRequired: true, order: 8 },
  { name: "HOA Governing Documents", description: "Required only if the property is part of a common interest development (HOA)", isRequired: false, order: 9 },
];

const RESIDENTIAL_SALE_BUYER_ITEMS = [
  { name: "RPA-CA — California Residential Purchase Agreement", description: "The purchase contract", isRequired: true, order: 1 },
  { name: "BRBC — Buyer Representation and Broker Compensation Agreement", description: "Required before touring homes per the Aug. 2024 NAR settlement", isRequired: true, order: 2 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Civil Code §2079.13-2079.24", isRequired: true, order: 3 },
  { name: "AVID — Agent Visual Inspection Disclosure", description: "Agent's own visual inspection disclosure", isRequired: true, order: 4 },
  { name: "SBSA — Statewide Buyer and Seller Advisory", description: "C.A.R. consolidated general-disclosure advisory", isRequired: true, order: 5 },
  { name: "TDS — Real Estate Transfer Disclosure Statement", description: "Received from seller", isRequired: true, order: 6 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Received from seller/vendor", isRequired: true, order: 7 },
  { name: "FIRPTA / CA Withholding Affidavit", description: "Foreign Investment in Real Property Tax Act + CA state withholding certification", isRequired: true, order: 8 },
  { name: "Proof of Funds / Loan Pre-Approval Letter", description: "Lender pre-approval or proof of funds dated within 30 days", isRequired: true, order: 9 },
];

const RESIDENTIAL_SALE_SELLER_ITEMS = [
  { name: "RPA-CA — Countersigned Purchase Agreement", description: "Fully executed purchase contract", isRequired: true, order: 1 },
  { name: "TDS — Real Estate Transfer Disclosure Statement", description: "Civil Code §1102", isRequired: true, order: 2 },
  { name: "SPQ — Seller Property Questionnaire", description: "C.A.R. supplemental seller questionnaire", isRequired: true, order: 3 },
  { name: "SBSA — Statewide Buyer and Seller Advisory", description: "C.A.R. consolidated general-disclosure advisory", isRequired: true, order: 4 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Govt. Code §8589.3", isRequired: true, order: 5 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Civil Code §2079.13-2079.24", isRequired: true, order: 6 },
  { name: "DBD — Megan's Law Database Disclosure", description: "Civil Code §2079.10a", isRequired: true, order: 7 },
  { name: "WHSD — Water Heater & Smoke Detector Statement of Compliance", description: "Health & Safety Code compliance statement", isRequired: true, order: 8 },
  { name: "HOA Governing Documents", description: "Required only if the property is part of a common interest development (HOA)", isRequired: false, order: 9 },
];

const RESIDENTIAL_LEASE_LISTING_ITEMS = [
  { name: "LL — Lease Listing Agreement (Exclusive Authorization to Lease or Rent)", description: "Landlord's exclusive leasing listing contract", isRequired: true, order: 1 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Required for leases over 1 year; standard practice regardless", isRequired: true, order: 2 },
  { name: "LPD — Lead-Based Paint and Lead-Based Paint Hazards Disclosure", description: "Federal law, required only for housing built before 1978", isRequired: false, order: 3 },
];

const RESIDENTIAL_LEASE_TENANT_ITEMS = [
  { name: "RLMM — Residential Lease or Month-to-Month Rental Agreement", description: "The lease contract", isRequired: true, order: 1 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Required for leases over 1 year; standard practice regardless", isRequired: true, order: 2 },
  { name: "LPD — Lead-Based Paint and Lead-Based Paint Hazards Disclosure", description: "Federal law, required only for housing built before 1978", isRequired: false, order: 3 },
  { name: "MII — Move-In Inspection", description: "Signed condition checklist at move-in", isRequired: true, order: 4 },
];

const RESIDENTIAL_LEASE_LANDLORD_ITEMS = [
  { name: "RLMM — Residential Lease or Month-to-Month Rental Agreement", description: "The lease contract", isRequired: true, order: 1 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Required for leases over 1 year; standard practice regardless", isRequired: true, order: 2 },
  { name: "LPD — Lead-Based Paint and Lead-Based Paint Hazards Disclosure", description: "Federal law, required only for housing built before 1978", isRequired: false, order: 3 },
];

const DUAL_AGENCY_ITEMS = [
  { name: "RPA-CA — Purchase Agreement", description: "The purchase contract", isRequired: true, order: 1 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Civil Code §2079.13-2079.24", isRequired: true, order: 2 },
  { name: "AVID — Agent Visual Inspection Disclosure", description: "Agent's own visual inspection disclosure", isRequired: true, order: 3 },
  { name: "SBSA — Statewide Buyer and Seller Advisory", description: "C.A.R. consolidated general-disclosure advisory", isRequired: true, order: 4 },
  { name: "TDS — Real Estate Transfer Disclosure Statement", description: "Civil Code §1102", isRequired: true, order: 5 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Govt. Code §8589.3", isRequired: true, order: 6 },
  { name: "BRBC — Buyer Representation and Broker Compensation Agreement", description: "Required before touring homes per the Aug. 2024 NAR settlement", isRequired: true, order: 7 },
  { name: "FIRPTA / CA Withholding Affidavit", description: "Foreign Investment in Real Property Tax Act + CA state withholding certification", isRequired: true, order: 8 },
  { name: "Proof of Funds / Loan Pre-Approval Letter", description: "Lender pre-approval or proof of funds dated within 30 days", isRequired: true, order: 9 },
  { name: "SPQ — Seller Property Questionnaire", description: "C.A.R. supplemental seller questionnaire", isRequired: true, order: 10 },
  { name: "DBD — Megan's Law Database Disclosure", description: "Civil Code §2079.10a", isRequired: true, order: 11 },
  { name: "WHSD — Water Heater & Smoke Detector Statement of Compliance", description: "Health & Safety Code compliance statement", isRequired: true, order: 12 },
  { name: "HOA Governing Documents", description: "Required only if the property is part of a common interest development (HOA)", isRequired: false, order: 13 },
];

const LEASE_DUAL_AGENCY_ITEMS = [
  { name: "RLMM — Residential Lease or Month-to-Month Rental Agreement", description: "The lease contract", isRequired: true, order: 1 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Required for leases over 1 year; standard practice regardless", isRequired: true, order: 2 },
  { name: "LPD — Lead-Based Paint and Lead-Based Paint Hazards Disclosure", description: "Federal law, required only for housing built before 1978", isRequired: false, order: 3 },
  { name: "MII — Move-In Inspection", description: "Signed condition checklist at move-in", isRequired: true, order: 4 },
];

const REFERRAL_ITEMS = [
  { name: "RFA — Referral Fee Agreement", description: "Signed agreement between the CnC agent and the referred-to agent/brokerage", isRequired: false, order: 1 },
];

const COMMERCIAL_SALE_LISTING_ITEMS = [
  { name: "CLA — Commercial/Residential Income and Vacant Land Listing Agreement", description: "Exclusive commercial listing contract", isRequired: true, order: 1 },
  { name: "CSPQ — Commercial Seller Property Questionnaire", description: "C.A.R. commercial seller disclosure questionnaire", isRequired: true, order: 2 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Applies to commercial too, not residential-only. Govt. Code §8589.3", isRequired: true, order: 3 },
];

const COMMERCIAL_LEASE_LISTING_ITEMS = [
  { name: "CLA — Commercial/Residential Income and Vacant Land Listing Agreement", description: "C.A.R. uses this form for commercial lease listings too", isRequired: true, order: 1 },
  { name: "CL — Commercial Lease Agreement", description: "The executed lease, once signed", isRequired: true, order: 2 },
  { name: "CASp Disclosure", description: "Accessibility inspection status disclosure, legally required on every commercial lease. Civil Code §1938 (AB 2093)", isRequired: true, order: 3 },
  { name: "Prop 65 Warning", description: "Required only if the property contains chemicals known to the State of California to cause cancer or reproductive harm. Health & Safety Code §25249.6", isRequired: false, order: 4 },
];

const COMMERCIAL_PURCHASE_ITEMS = [
  { name: "CPA — Commercial Property Purchase Agreement & Joint Escrow Instructions", description: "The purchase contract", isRequired: true, order: 1 },
  { name: "CSPQ — Commercial Seller Property Questionnaire", description: "Received from seller", isRequired: true, order: 2 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Received from seller/vendor. Govt. Code §8589.3", isRequired: true, order: 3 },
];

const COMMERCIAL_LISTING_TX_ITEMS = [
  { name: "CPA — Commercial Property Purchase Agreement & Joint Escrow Instructions", description: "Fully executed purchase contract", isRequired: true, order: 1 },
  { name: "CSPQ — Commercial Seller Property Questionnaire", description: "C.A.R. commercial seller disclosure questionnaire", isRequired: true, order: 2 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Govt. Code §8589.3", isRequired: true, order: 3 },
];

const COMMERCIAL_DUAL_ITEMS = [
  { name: "CPA — Commercial Property Purchase Agreement & Joint Escrow Instructions", description: "The purchase contract", isRequired: true, order: 1 },
  { name: "CSPQ — Commercial Seller Property Questionnaire", description: "C.A.R. commercial seller disclosure questionnaire", isRequired: true, order: 2 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Govt. Code §8589.3", isRequired: true, order: 3 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Civil Code §2079.13-2079.24", isRequired: true, order: 4 },
];

const COMMERCIAL_LEASE_TENANT_ITEMS = [
  { name: "CL — Commercial Lease Agreement", description: "The lease contract", isRequired: true, order: 1 },
  { name: "CASp Disclosure", description: "Accessibility inspection status disclosure, legally required on every commercial lease. Civil Code §1938 (AB 2093)", isRequired: true, order: 2 },
  { name: "Prop 65 Warning", description: "Required only if the property contains listed chemicals. Health & Safety Code §25249.6", isRequired: false, order: 3 },
];

const COMMERCIAL_LEASE_LANDLORD_ITEMS = [
  { name: "CL — Commercial Lease Agreement", description: "The lease contract", isRequired: true, order: 1 },
  { name: "CASp Disclosure", description: "Accessibility inspection status disclosure, legally required on every commercial lease. Civil Code §1938 (AB 2093)", isRequired: true, order: 2 },
  { name: "Prop 65 Warning", description: "Required only if the property contains listed chemicals. Health & Safety Code §25249.6", isRequired: false, order: 3 },
];

const COMMERCIAL_LEASE_DUAL_ITEMS = [
  { name: "CL — Commercial Lease Agreement", description: "The lease contract", isRequired: true, order: 1 },
  { name: "CASp Disclosure", description: "Accessibility inspection status disclosure, legally required on every commercial lease. Civil Code §1938 (AB 2093)", isRequired: true, order: 2 },
  { name: "Prop 65 Warning", description: "Required only if the property contains listed chemicals. Health & Safety Code §25249.6", isRequired: false, order: 3 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Civil Code §2079.13-2079.24", isRequired: true, order: 4 },
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

  async function upsertTemplate(
    id: string,
    name: string,
    fileType: "LISTING" | "TRANSACTION",
    listingType: string,
    transactionSide: string,
    propertyCategory: string,
    items: { name: string; description: string; isRequired: boolean; order: number }[]
  ) {
    await prisma.checklistTemplateItem.deleteMany({ where: { templateId: id } });
    return prisma.checklistTemplate.upsert({
      where: { id },
      update: { name, fileType, listingType, transactionSide, propertyCategory, items: { create: items } },
      create: { id, name, fileType, listingType, transactionSide, propertyCategory, isActive: true, items: { create: items } },
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
