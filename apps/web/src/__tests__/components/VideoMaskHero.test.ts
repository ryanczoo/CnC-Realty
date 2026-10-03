import { describe, it, expect } from "vitest";
import { phoneWordLayout } from "@/components/ui/VideoMaskHero";

describe("phoneWordLayout", () => {
  it("puts one word per line, centred vertically on the 1920-tall canvas", () => {
    expect(phoneWordLayout(["SELL", "WITH US"])).toEqual([
      { word: "SELL", y: 700 },
      { word: "WITH", y: 960 },
      { word: "US", y: 1220 },
    ]);
  });

  it("centres a single word", () => {
    expect(phoneWordLayout(["PRESS"])).toEqual([{ word: "PRESS", y: 960 }]);
  });

  it("ignores extra spaces", () => {
    expect(phoneWordLayout(["MANAGE", " WITH  US "]).map((w) => w.word)).toEqual(["MANAGE", "WITH", "US"]);
  });
});
