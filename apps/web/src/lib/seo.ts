import type { Metadata } from "next";

export const SITE_URL = "https://cncrealtygroup.com";
export const BRAND = "CnC Realty";
export const OG_IMAGE = { url: "/og-default.jpg", width: 1200, height: 630, alt: BRAND };

type OgImages = NonNullable<NonNullable<Metadata["openGraph"]>["images"]>;

export const PAGE_SEO = {
  "/": {
    title: "CnC Realty | California Real Estate Brokerage",
    absolute: true,
    description:
      "California real estate brokerage. Search homes for sale and rent, connect with local agents, and join CnC Realty.",
  },
  "/buy": {
    title: "Buy a Home in California",
    description:
      "Search thousands of California homes with CnC Realty. Expert buyer's agents, live MLS listings, and zero pressure.",
  },
  "/sell": {
    title: "Sell Your Home in California",
    description:
      "List with CnC Realty and get full CRMLS exposure, expert pricing, and a dedicated agent to manage your sale from start to close.",
  },
  "/rent": {
    title: "Homes for Rent in California",
    description:
      "Find your next rental in California with CnC Realty. Live CRMLS lease listings with expert tenant representation.",
  },
  "/manage": {
    title: "Property Management",
    description:
      "Full-service property management across Southern California. Tenant placement, rent collection, maintenance coordination, and more.",
  },
  "/join": {
    title: "Join CnC Realty | 100% Commission Brokerage in California",
    absolute: true,
    description:
      "100% commission, AI-driven CRM, and real mentorship. Join CnC Realty and build the real estate career you've always wanted.",
  },
  "/press": {
    title: "Press",
    description: "Market updates, real estate tips, and news from CnC Realty.",
  },
  "/home-value": {
    title: "What's My Home Worth? Free Home Value Estimate",
    description: "Get a free estimate of your California home's value based on recent nearby sales.",
  },
  "/contact": {
    title: "Contact CnC Realty",
    absolute: true,
    description:
      "Contact CnC Realty, a California real estate brokerage. Send us a message and we'll get back to you quickly.",
  },
  "/properties": {
    title: "Homes for Sale in California",
    description:
      "Search active homes for sale and for rent across California, updated from CRMLS every 15 minutes.",
  },
  "/accessibility": {
    title: "Accessibility",
    description:
      "CnC Realty's commitment to web accessibility and how to contact us if you experience difficulty accessing our website.",
  },
  "/privacy": {
    title: "Privacy Policy",
    description:
      "CnC Realty Privacy Policy — how we collect, use, and protect your personal information under California law.",
  },
  "/terms": {
    title: "Terms of Service",
    description: "CnC Realty Terms of Service — the rules governing your use of cncrealtygroup.com.",
  },
  "/fair-housing": {
    title: "Fair Housing Notice",
    description:
      "CnC Realty Fair Housing Notice — our commitment to equal housing opportunity under federal and California law.",
  },
} satisfies Record<string, { title: string; absolute?: boolean; description: string }>;

export type SeoPath = keyof typeof PAGE_SEO;

function shareTitle(title: string, absolute?: boolean) {
  return absolute ? title : `${title} | ${BRAND}`;
}

export function pageMeta(path: SeoPath): Metadata {
  const { title, description, absolute } = PAGE_SEO[path] as {
    title: string;
    description: string;
    absolute?: boolean;
  };
  return {
    title: absolute ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: shareTitle(title, absolute),
      description,
      url: path,
      siteName: BRAND,
      type: "website",
      images: [OG_IMAGE],
    },
  };
}

// For pages whose title/description come from data (listings, agents, press posts).
export function canonicalMeta(
  path: string,
  title: string,
  description: string,
  images?: OgImages,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: shareTitle(title),
      description,
      url: path,
      siteName: BRAND,
      type: "website",
      images: images ?? [OG_IMAGE],
    },
  };
}
