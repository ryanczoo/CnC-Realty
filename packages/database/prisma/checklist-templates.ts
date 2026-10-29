// Checklist template contents — the source of truth seed.ts writes to the database,
// kept separate so tests can check them without running the seed.

// Year-based items: an item with builtBefore N goes on a file only when its Year
// Built is earlier than N (lib/year-checklist.ts). Not exported. Every export is a
// checklist array except AD_ITEM_NAME (the name of the optional Agency Disclosure row).
const LPD = { name: "LPD — Lead-Based Paint and Lead-Based Paint Hazards Disclosure", description: "Federal law for housing built before 1978; include the EPA pamphlet \"Protect Your Family From Lead in Your Home\"", isRequired: true, builtBefore: 1978 };
const RES_EARTHQUAKE = { name: "Residential Earthquake Hazards Report (Homeowner's Guide to Earthquake Safety)", description: "Required for 1–4 unit homes built before 1960. Gov. Code §8897.1", isRequired: true, builtBefore: 1960 };
const COMMERCIAL_EARTHQUAKE = { name: "Commercial Property Owner's Guide to Earthquake Safety (precast concrete or reinforced masonry buildings only)", description: "For precast concrete or reinforced masonry buildings built before 1975. Gov. Code §8893.2", isRequired: false, builtBefore: 1975 };

// Optional Agency Disclosure row — sits below the required items on 10 templates.
export const AD_ITEM_NAME = "AD — Agency Disclosure (if not already included)";
const AD = { name: AD_ITEM_NAME, description: null, isRequired: false };

// Listing-document rows: the listing agreement (and AVID) the agent already has on the
// listing file. On a transaction file they lead the list with skipWhenConverted, so a
// Listing converted to a Transaction does not ask for them a second time.
const RLA = { name: "RLA — Residential Listing Agreement (Exclusive)", description: "Signed exclusive right-to-sell listing contract" };
const AVID = { name: "AVID — Agent Visual Inspection Disclosure", description: "Agent's own visual inspection disclosure, Civil Code §2079" };
const LL = { name: "LL — Lease Listing Agreement (Exclusive Authorization to Lease or Rent)", description: "Landlord's exclusive leasing listing contract" };
const CLA = { name: "CLA — Commercial/Residential Income and Vacant Land Listing Agreement", description: "Exclusive commercial listing contract" };

export const RESIDENTIAL_SALE_LISTING_ITEMS = [
  { ...RLA, isRequired: true, order: 1 },
  { ...AVID, isRequired: true, order: 2 },
  { name: "TDS — Real Estate Transfer Disclosure Statement", description: "Seller's statutory disclosure, Civil Code §1102", isRequired: true, order: 3 },
  { name: "SPQ — Seller Property Questionnaire", description: "C.A.R. supplemental seller questionnaire", isRequired: true, order: 4 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Ordered from a third-party NHD vendor, not a C.A.R. form. Govt. Code §8589.3", isRequired: true, order: 5 },
  { ...LPD, order: 6 },
  { ...RES_EARTHQUAKE, order: 7 },
  { ...AD, order: 8 },
  { name: "WHSD — Water Heater & Smoke Detector Statement of Compliance (required if TDS-exempt)", description: "Health & Safety Code water heater bracing + smoke/CO detector compliance", isRequired: false, order: 9 },
  { name: "HOA Governing Documents", description: "Required only if the property is part of a common interest development (HOA)", isRequired: false, order: 10 },
];

export const RESIDENTIAL_SALE_BUYER_ITEMS = [
  { name: "RPA-CA — California Residential Purchase Agreement", description: "The purchase contract", isRequired: true, order: 1 },
  { name: "BRBC — Buyer Representation and Broker Compensation Agreement", description: "Required before touring homes per the Aug. 2024 NAR settlement", isRequired: true, order: 2 },
  { name: "AVID — Agent Visual Inspection Disclosure", description: "Agent's own visual inspection disclosure", isRequired: true, order: 3 },
  { name: "SBSA — Statewide Buyer and Seller Advisory", description: "C.A.R. consolidated general-disclosure advisory", isRequired: true, order: 4 },
  { name: "TDS — Real Estate Transfer Disclosure Statement", description: "Received from seller", isRequired: true, order: 5 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Received from seller/vendor", isRequired: true, order: 6 },
  { name: "FIRPTA / CA Withholding Affidavit", description: "Foreign Investment in Real Property Tax Act + CA state withholding certification", isRequired: true, order: 7 },
  { name: "Proof of Funds / Loan Pre-Approval Letter", description: "Lender pre-approval or proof of funds dated within 30 days", isRequired: true, order: 8 },
  { ...LPD, order: 9 },
  { ...RES_EARTHQUAKE, order: 10 },
  { ...AD, order: 11 },
  { name: "DBD — Megan's Law Database Disclosure (Required if not using C.A.R. RPA/RIPA)", description: "The Megan's Law notice is pre-printed in the C.A.R. RPA and RIPA; this form is needed only with another purchase contract. Civil Code §2079.10a", isRequired: false, order: 12 },
];

export const RESIDENTIAL_SALE_SELLER_ITEMS = [
  { ...RLA, isRequired: true, skipWhenConverted: true, order: 1 },
  { ...AVID, isRequired: true, skipWhenConverted: true, order: 2 },
  { name: "RPA-CA — Countersigned Purchase Agreement", description: "Fully executed purchase contract", isRequired: true, order: 3 },
  { name: "TDS — Real Estate Transfer Disclosure Statement", description: "Civil Code §1102", isRequired: true, order: 4 },
  { name: "SPQ — Seller Property Questionnaire", description: "C.A.R. supplemental seller questionnaire", isRequired: true, order: 5 },
  { name: "SBSA — Statewide Buyer and Seller Advisory", description: "C.A.R. consolidated general-disclosure advisory", isRequired: true, order: 6 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Govt. Code §8589.3", isRequired: true, order: 7 },
  { ...LPD, order: 8 },
  { ...RES_EARTHQUAKE, order: 9 },
  { ...AD, order: 10 },
  { name: "DBD — Megan's Law Database Disclosure (Required if not using C.A.R. RPA/RIPA)", description: "The Megan's Law notice is pre-printed in the C.A.R. RPA and RIPA; this form is needed only with another purchase contract. Civil Code §2079.10a", isRequired: false, order: 11 },
  { name: "WHSD — Water Heater & Smoke Detector Statement of Compliance (required if TDS-exempt)", description: "Health & Safety Code compliance statement", isRequired: false, order: 12 },
  { name: "HOA Governing Documents", description: "Required only if the property is part of a common interest development (HOA)", isRequired: false, order: 13 },
];

export const RESIDENTIAL_LEASE_LISTING_ITEMS = [
  { ...LL, isRequired: true, order: 1 },
  { ...LPD, order: 2 },
  { ...AD, order: 3 },
];

export const RESIDENTIAL_LEASE_TENANT_ITEMS = [
  { name: "RLMM — Residential Lease or Month-to-Month Rental Agreement", description: "The lease contract", isRequired: true, order: 1 },
  { ...LPD, order: 2 },
  { name: "MII — Move-In Inspection", description: "Signed condition checklist at move-in", isRequired: true, order: 3 },
  { ...AD, order: 4 },
];

export const RESIDENTIAL_LEASE_LANDLORD_ITEMS = [
  { ...LL, isRequired: true, skipWhenConverted: true, order: 1 },
  { name: "RLMM — Residential Lease or Month-to-Month Rental Agreement", description: "The lease contract", isRequired: true, order: 2 },
  { ...LPD, order: 3 },
  { ...AD, order: 4 },
];

export const DUAL_AGENCY_ITEMS = [
  { ...RLA, isRequired: true, skipWhenConverted: true, order: 1 },
  { name: "AVID — Agent Visual Inspection Disclosure", description: "Agent's own visual inspection disclosure", isRequired: true, skipWhenConverted: true, order: 2 },
  { name: "RPA-CA — Purchase Agreement", description: "The purchase contract", isRequired: true, order: 3 },
  { name: "SBSA — Statewide Buyer and Seller Advisory", description: "C.A.R. consolidated general-disclosure advisory", isRequired: true, order: 4 },
  { name: "TDS — Real Estate Transfer Disclosure Statement", description: "Civil Code §1102", isRequired: true, order: 5 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Govt. Code §8589.3", isRequired: true, order: 6 },
  { name: "BRBC — Buyer Representation and Broker Compensation Agreement", description: "Required before touring homes per the Aug. 2024 NAR settlement", isRequired: true, order: 7 },
  { name: "FIRPTA / CA Withholding Affidavit", description: "Foreign Investment in Real Property Tax Act + CA state withholding certification", isRequired: true, order: 8 },
  { name: "Proof of Funds / Loan Pre-Approval Letter", description: "Lender pre-approval or proof of funds dated within 30 days", isRequired: true, order: 9 },
  { name: "SPQ — Seller Property Questionnaire", description: "C.A.R. supplemental seller questionnaire", isRequired: true, order: 10 },
  { ...LPD, order: 11 },
  { ...RES_EARTHQUAKE, order: 12 },
  { ...AD, order: 13 },
  { name: "DBD — Megan's Law Database Disclosure (Required if not using C.A.R. RPA/RIPA)", description: "The Megan's Law notice is pre-printed in the C.A.R. RPA and RIPA; this form is needed only with another purchase contract. Civil Code §2079.10a", isRequired: false, order: 14 },
  { name: "WHSD — Water Heater & Smoke Detector Statement of Compliance (required if TDS-exempt)", description: "Health & Safety Code compliance statement", isRequired: false, order: 15 },
  { name: "HOA Governing Documents", description: "Required only if the property is part of a common interest development (HOA)", isRequired: false, order: 16 },
];

export const LEASE_DUAL_AGENCY_ITEMS = [
  { ...LL, isRequired: true, skipWhenConverted: true, order: 1 },
  { name: "RLMM — Residential Lease or Month-to-Month Rental Agreement", description: "The lease contract", isRequired: true, order: 2 },
  { ...LPD, order: 3 },
  { name: "MII — Move-In Inspection", description: "Signed condition checklist at move-in", isRequired: true, order: 4 },
  { ...AD, order: 5 },
];

export const REFERRAL_ITEMS = [
  { name: "RFA — Referral Fee Agreement", description: "Signed agreement between the CnC agent and the referred-to agent/brokerage", isRequired: false, order: 1 },
];

export const COMMERCIAL_SALE_LISTING_ITEMS = [
  { ...CLA, isRequired: true, order: 1 },
  { name: "CSPQ — Commercial Seller Property Questionnaire", description: "C.A.R. commercial seller disclosure questionnaire", isRequired: true, order: 2 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Applies to commercial too, not residential-only. Govt. Code §8589.3", isRequired: true, order: 3 },
  { ...COMMERCIAL_EARTHQUAKE, order: 4 },
];

export const COMMERCIAL_LEASE_LISTING_ITEMS = [
  { name: "CLA — Commercial/Residential Income and Vacant Land Listing Agreement", description: "C.A.R. uses this form for commercial lease listings too", isRequired: true, order: 1 },
  { name: "CL — Commercial Lease Agreement", description: "The executed lease, once signed", isRequired: true, order: 2 },
  { name: "CASp Disclosure", description: "Accessibility inspection status disclosure, legally required on every commercial lease. Civil Code §1938 (AB 2093)", isRequired: true, order: 3 },
  { name: "Prop 65 Warning", description: "Required only if the property contains chemicals known to the State of California to cause cancer or reproductive harm. Health & Safety Code §25249.6", isRequired: false, order: 4 },
];

export const COMMERCIAL_PURCHASE_ITEMS = [
  { name: "CPA — Commercial Property Purchase Agreement & Joint Escrow Instructions", description: "The purchase contract", isRequired: true, order: 1 },
  { name: "CSPQ — Commercial Seller Property Questionnaire", description: "Received from seller", isRequired: true, order: 2 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Received from seller/vendor. Govt. Code §8589.3", isRequired: true, order: 3 },
  { ...COMMERCIAL_EARTHQUAKE, order: 4 },
];

export const COMMERCIAL_LISTING_TX_ITEMS = [
  { ...CLA, isRequired: true, skipWhenConverted: true, order: 1 },
  { name: "CPA — Commercial Property Purchase Agreement & Joint Escrow Instructions", description: "Fully executed purchase contract", isRequired: true, order: 2 },
  { name: "CSPQ — Commercial Seller Property Questionnaire", description: "C.A.R. commercial seller disclosure questionnaire", isRequired: true, order: 3 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Govt. Code §8589.3", isRequired: true, order: 4 },
  { ...COMMERCIAL_EARTHQUAKE, order: 5 },
];

export const COMMERCIAL_DUAL_ITEMS = [
  { ...CLA, isRequired: true, skipWhenConverted: true, order: 1 },
  { name: "CPA — Commercial Property Purchase Agreement & Joint Escrow Instructions", description: "The purchase contract", isRequired: true, order: 2 },
  { name: "CSPQ — Commercial Seller Property Questionnaire", description: "C.A.R. commercial seller disclosure questionnaire", isRequired: true, order: 3 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Govt. Code §8589.3", isRequired: true, order: 4 },
  { ...AD, order: 5 },
  { ...COMMERCIAL_EARTHQUAKE, order: 6 },
];

export const COMMERCIAL_LEASE_TENANT_ITEMS = [
  { name: "CL — Commercial Lease Agreement", description: "The lease contract", isRequired: true, order: 1 },
  { name: "CASp Disclosure", description: "Accessibility inspection status disclosure, legally required on every commercial lease. Civil Code §1938 (AB 2093)", isRequired: true, order: 2 },
  { name: "Prop 65 Warning", description: "Required only if the property contains listed chemicals. Health & Safety Code §25249.6", isRequired: false, order: 3 },
];

export const COMMERCIAL_LEASE_LANDLORD_ITEMS = [
  { ...CLA, isRequired: true, skipWhenConverted: true, order: 1 },
  { name: "CL — Commercial Lease Agreement", description: "The lease contract", isRequired: true, order: 2 },
  { name: "CASp Disclosure", description: "Accessibility inspection status disclosure, legally required on every commercial lease. Civil Code §1938 (AB 2093)", isRequired: true, order: 3 },
  { name: "Prop 65 Warning", description: "Required only if the property contains listed chemicals. Health & Safety Code §25249.6", isRequired: false, order: 4 },
];

export const COMMERCIAL_LEASE_DUAL_ITEMS = [
  { ...CLA, isRequired: true, skipWhenConverted: true, order: 1 },
  { name: "CL — Commercial Lease Agreement", description: "The lease contract", isRequired: true, order: 2 },
  { name: "CASp Disclosure", description: "Accessibility inspection status disclosure, legally required on every commercial lease. Civil Code §1938 (AB 2093)", isRequired: true, order: 3 },
  { ...AD, order: 4 },
  { name: "Prop 65 Warning", description: "Required only if the property contains listed chemicals. Health & Safety Code §25249.6", isRequired: false, order: 5 },
];
