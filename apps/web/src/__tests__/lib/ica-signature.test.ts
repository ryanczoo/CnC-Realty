import { describe, it, expect } from "vitest";
import { namesMatch } from "@/lib/ica-signature";

describe("namesMatch", () => {
  it("matches an exact name", () => {
    expect(namesMatch("Jane Smith", "Jane", "Smith")).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(namesMatch("jane smith", "Jane", "Smith")).toBe(true);
  });

  it("matches with extra/irregular whitespace", () => {
    expect(namesMatch("  Jane   Smith  ", "Jane", "Smith")).toBe(true);
  });

  it("rejects a different name", () => {
    expect(namesMatch("John Smith", "Jane", "Smith")).toBe(false);
  });

  it("rejects an empty signature", () => {
    expect(namesMatch("", "Jane", "Smith")).toBe(false);
  });
});
