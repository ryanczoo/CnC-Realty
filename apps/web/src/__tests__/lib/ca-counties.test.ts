import { describe, it, expect } from "vitest";
import { CA_COUNTIES, BAY_AREA_COUNTIES } from "@/lib/ca-counties";

describe("CA counties", () => {
  it("has all 58 California counties, spelled as the MLS stores them", () => {
    expect(CA_COUNTIES).toHaveLength(58);
    expect(CA_COUNTIES).toContain("Los Angeles");
    expect(CA_COUNTIES).toContain("San Luis Obispo");
    expect(CA_COUNTIES).toContain("Del Norte");
  });
  it("Bay Area is the standard nine, all real counties", () => {
    expect([...BAY_AREA_COUNTIES].sort()).toEqual(
      ["Alameda", "Contra Costa", "Marin", "Napa", "San Francisco", "San Mateo", "Santa Clara", "Solano", "Sonoma"]);
    for (const c of BAY_AREA_COUNTIES) expect(CA_COUNTIES).toContain(c);
  });
});
