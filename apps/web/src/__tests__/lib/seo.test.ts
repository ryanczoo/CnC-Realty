import { describe, it, expect } from "vitest";
import { PAGE_SEO, OG_IMAGE, SITE_URL, pageMeta, canonicalMeta, type SeoPath } from "@/lib/seo";

const paths = Object.keys(PAGE_SEO) as SeoPath[];

describe("PAGE_SEO", () => {
  it("uses the agreed titles", () => {
    expect(PAGE_SEO["/buy"].title).toBe("Buy a Home in California");
    expect(PAGE_SEO["/sell"].title).toBe("Sell Your Home in California");
    expect(PAGE_SEO["/rent"].title).toBe("Homes for Rent in California");
    expect(PAGE_SEO["/manage"].title).toBe("Property Management");
    expect(PAGE_SEO["/press"].title).toBe("Press");
    expect(PAGE_SEO["/home-value"].title).toBe("What's My Home Worth? Free Home Value Estimate");
    expect(PAGE_SEO["/properties"].title).toBe("Homes for Sale in California");
  });

  it("gives /join and /contact full titles that skip the template", () => {
    expect(PAGE_SEO["/join"]).toMatchObject({
      title: "Join CnC Realty | 100% Commission Brokerage in California",
      absolute: true,
    });
    expect(PAGE_SEO["/contact"]).toMatchObject({ title: "Contact CnC Realty", absolute: true });
  });

  it("never says CnC Realty Group, and only /manage says Southern California", () => {
    for (const p of paths) {
      const { title, description } = PAGE_SEO[p];
      expect(title).not.toContain("CnC Realty Group");
      expect(description).not.toContain("CnC Realty Group");
      expect(title).not.toContain("Southern California");
      if (p === "/manage") expect(description).toContain("Southern California");
      else expect(description).not.toContain("Southern California");
    }
  });

  it("covers every public static path", () => {
    expect(paths.sort()).toEqual(
      [
        "/", "/accessibility", "/buy", "/contact", "/fair-housing", "/home-value", "/join",
        "/manage", "/press", "/privacy", "/properties", "/rent", "/sell", "/terms",
      ].sort(),
    );
  });
});

describe("pageMeta", () => {
  it("sets canonical, share title and default image", () => {
    const m = pageMeta("/buy");
    expect(m.alternates?.canonical).toBe("/buy");
    expect(m.title).toBe("Buy a Home in California");
    const og = m.openGraph as { title: string; url: string; siteName: string; images: { url: string }[] };
    expect(og.title).toBe("Buy a Home in California | CnC Realty");
    expect(og.url).toBe("/buy");
    expect(og.siteName).toBe("CnC Realty");
    expect(og.images[0].url).toBe("/og-default.jpg");
  });

  it("uses an absolute title for /join and shares the same string", () => {
    const m = pageMeta("/join");
    expect(m.title).toEqual({ absolute: "Join CnC Realty | 100% Commission Brokerage in California" });
    expect((m.openGraph as { title: string }).title).toBe("Join CnC Realty | 100% Commission Brokerage in California");
  });

  it("homepage has an absolute default title and a / canonical", () => {
    const m = pageMeta("/");
    expect(m.title).toEqual({ absolute: "CnC Realty | California Real Estate Brokerage" });
    expect(m.alternates?.canonical).toBe("/");
  });
});

describe("canonicalMeta", () => {
  it("returns a plain title (template adds the brand) and a matching share card", () => {
    const m = canonicalMeta("/properties/123", "12 Main St, Pasadena", "A nice home.");
    expect(m.title).toBe("12 Main St, Pasadena");
    expect(m.description).toBe("A nice home.");
    expect(m.alternates?.canonical).toBe("/properties/123");
    expect(m.openGraph).toMatchObject({
      title: "12 Main St, Pasadena | CnC Realty",
      description: "A nice home.",
      url: "/properties/123",
      siteName: "CnC Realty",
      type: "website",
      images: [OG_IMAGE],
    });
  });

  it("uses supplied images instead of the default", () => {
    const imgs = [{ url: "https://x/y.jpg" }];
    const m = canonicalMeta("/a", "T", "D", imgs);
    expect((m.openGraph as { images: unknown }).images).toEqual(imgs);
  });
});

describe("constants", () => {
  it("exposes the site url", () => {
    expect(SITE_URL).toBe("https://cncrealtygroup.com");
    expect(OG_IMAGE).toEqual({ url: "/og-default.jpg", width: 1200, height: 630, alt: "CnC Realty" });
  });
});

describe("noindexMeta", () => {
  it("names the page and keeps it out of search results", async () => {
    const { noindexMeta } = await import("@/lib/seo");
    expect(noindexMeta("Sign In")).toEqual({ title: "Sign In", robots: { index: false, follow: false } });
  });

  it("is applied to every account and email-preference page", async () => {
    const layouts = await Promise.all([
      import("@/app/(auth)/login/layout"),
      import("@/app/(auth)/register/layout"),
      import("@/app/(auth)/forgot-password/layout"),
      import("@/app/(auth)/reset-password/layout"),
      import("@/app/(marketing)/setup-account/layout"),
      import("@/app/(marketing)/unsubscribe/layout"),
    ]);
    for (const l of layouts) expect(l.metadata.robots).toEqual({ index: false, follow: false });
  });
});
