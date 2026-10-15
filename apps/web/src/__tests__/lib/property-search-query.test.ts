import { describe, it, expect } from "vitest";
import { buildLocationWhere } from "@/lib/property-search-query";

const ins = (contains: string) => ({ contains, mode: "insensitive" });
const place = (t: string) => ({ OR: [{ city: ins(t) }, { area: ins(t) }] });
const addr = (num: string, ...rest: object[]) => ({ AND: [{ address: { startsWith: `${num} `, mode: "insensitive" } }, ...rest] });

describe("buildLocationWhere", () => {
  describe("unchanged basics", () => {
    it("exact 5-digit zip", () => expect(buildLocationWhere("90210")).toEqual({ zip: "90210" }));
    it("number-only stays a plain address search", () => {
      expect(buildLocationWhere("1234")).toEqual({ address: ins("1234") });
      expect(buildLocationWhere("123456")).toEqual({ address: ins("123456") });
    });
    it("a city matches the city or the MLS neighborhood", () => {
      expect(buildLocationWhere("Anaheim")).toEqual(place("Anaheim"));
      expect(buildLocationWhere("Cerritos")).toEqual(place("Cerritos"));
    });
  });

  describe("city typed with a state", () => {
    it.each([
      ["monterey park, california", "monterey park"],
      ["monterey park, ca", "monterey park"],
      ["Los Angeles, CA", "Los Angeles"],
      ["Los Angeles CA", "Los Angeles"],
      ["Los Angeles, Calif.", "Los Angeles"],
      ["Pasadena, CA, USA", "Pasadena"],
      ["Pasadena, California, United States", "Pasadena"],
      ["  Monterey   Park ,  CA  ", "Monterey Park"],
    ])("%s → %s", (q, c) => expect(buildLocationWhere(q)).toEqual(place(c)));
    it("keeps a name that merely ends in the letters ca", () => expect(buildLocationWhere("Fonseca")).toEqual(place("Fonseca")));
    it("falls back to the raw text when only a state was typed", () => expect(buildLocationWhere("California")).toEqual(place("California")));
  });

  describe("zip inside a longer location", () => {
    it.each([
      ["Monterey Park CA 91754", "91754"],
      ["Monterey Park, CA 91754", "91754"],
      ["91754, CA", "91754"],
      ["Monterey Park 91754-1234", "91754"],
    ])("%s → zip %s", (q, z) => expect(buildLocationWhere(q)).toEqual({ zip: z }));
  });

  describe("addresses: house number + street name, street type ignored", () => {
    it.each([
      ["12802 Cantrece Street", addr("12802", { address: ins("Cantrece") })],
      ["328 N Lincoln Avenue", addr("328", { address: ins("Lincoln") })],
      ["328 North Lincoln Ave", addr("328", { address: ins("Lincoln") })],
      ["328 Lincoln Ave", addr("328", { address: ins("Lincoln") })],
      ["328 N. Lincoln Ave.", addr("328", { address: ins("Lincoln") })],
      ["1288 Glen Oaks Blvd", addr("1288", { address: ins("Glen Oaks") })],
      ["100 North Ave", addr("100", { address: ins("North") })],
      ["111 Marguerita Unit 100", addr("111", { address: ins("Marguerita") }, { address: ins("#100") })],
      ["111 Marguerita Ave #100", addr("111", { address: ins("Marguerita") }, { address: ins("#100") })],
      ["111 Marguerita Apt. 100", addr("111", { address: ins("Marguerita") }, { address: ins("#100") })],
      ["3 Bedford Ave", addr("3", { address: ins("Bedford") })],
    ])("%s", (q, where) => expect(buildLocationWhere(q)).toEqual(where));

    it("a city after a comma must match too (city or neighborhood)", () => {
      expect(buildLocationWhere("123 Main St, Monterey Park, CA")).toEqual(addr("123", { address: ins("Main") }, place("Monterey Park")));
      expect(buildLocationWhere("123 Main St, Monterey Park, CA 91754")).toEqual(addr("123", { address: ins("Main") }, place("Monterey Park")));
      expect(buildLocationWhere("12802 Cantrece Street, Cerritos")).toEqual(addr("12802", { address: ins("Cantrece") }, place("Cerritos")));
    });
  });

  describe("counties and Bay Area", () => {
    it.each([
      ["Orange County", "Orange"],
      ["orange county, ca", "Orange"],
      ["Los Angeles County", "Los Angeles"],
      ["San Luis Obispo County, California", "San Luis Obispo"],
    ])("%s → county %s", (q, c) => expect(buildLocationWhere(q)).toEqual({ county: c }));
    it("Bay Area → its nine counties", () => {
      const w = buildLocationWhere("Bay Area, CA") as { county: { in: string[] } };
      expect(w.county.in).toHaveLength(9);
      expect(w.county.in).toContain("Santa Clara");
    });
    it("an unknown county name falls back to a place search", () => expect(buildLocationWhere("Fake County")).toEqual(place("Fake County")));
  });

  describe("street + city, and street alone", () => {
    it("splits at the street type", () => {
      expect(buildLocationWhere("Atlantic Blvd Monterey Park")).toEqual({ AND: [{ address: ins("Atlantic") }, place("Monterey Park")] });
      expect(buildLocationWhere("Atlantic Blvd, Monterey Park, CA")).toEqual({ AND: [{ address: ins("Atlantic") }, place("Monterey Park")] });
      expect(buildLocationWhere("Main St Alhambra")).toEqual({ AND: [{ address: ins("Main") }, place("Alhambra")] });
    });
    it("a bare name ending in a street word stays a place search (never an address match on its own)", () => {
      expect(buildLocationWhere("Atlantic Blvd")).toEqual(place("Atlantic Blvd"));
      // a real LA neighborhood that ends in a street-type word
      expect(buildLocationWhere("Lake View Terrace")).toEqual(place("Lake View Terrace"));
    });
    it("a leading 'St' is a city word, not a street type", () => expect(buildLocationWhere("St Helena")).toEqual(place("St Helena")));
  });

  it("neighborhoods go through the same city-or-area match", () => {
    expect(buildLocationWhere("Silver Lake")).toEqual(place("Silver Lake"));
    expect(buildLocationWhere("Koreatown")).toEqual(place("Koreatown"));
  });
});
