import { describe, it, expect } from "vitest";
import { ICA_VERSION, ICA_INTRO, ICA_SECTIONS, SIGNATURE_LABELS, SUMMARY_TABLE, richTextToPlain } from "@/lib/ica-content";

describe("ica-content", () => {
  it("has a version string in YYYY-MM-DD format", () => {
    expect(ICA_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("has a non-empty intro paragraph", () => {
    expect(richTextToPlain(ICA_INTRO).length).toBeGreaterThan(20);
  });

  it("has exactly 28 numbered sections in order 1..28", () => {
    expect(ICA_SECTIONS).toHaveLength(28);
    ICA_SECTIONS.forEach((s, i) => expect(s.num).toBe(String(i + 1)));
  });

  it("every section has at least one content item", () => {
    ICA_SECTIONS.forEach((s) => expect(s.content.length).toBeGreaterThan(0));
  });

  it("section 7 contains the fee table with 8 rows", () => {
    const section7 = ICA_SECTIONS.find((s) => s.num === "7")!;
    const table = section7.content.find((c) => c.type === "table");
    expect(table).toBeDefined();
    expect((table as { rows: string[][] }).rows).toHaveLength(8);
  });

  it("has 5 signature labels", () => {
    expect(SIGNATURE_LABELS).toHaveLength(5);
  });

  it("has a 2-column summary table with 12 rows", () => {
    expect(SUMMARY_TABLE.headers).toHaveLength(2);
    expect(SUMMARY_TABLE.rows).toHaveLength(12);
  });

  it("supports inline bold spans mid-sentence", () => {
    const section7 = ICA_SECTIONS.find((s) => s.num === "7")!;
    const item72 = section7.content.find((c) => c.type === "sub" && c.id === "7.2") as { text: unknown };
    expect(Array.isArray(item72.text)).toBe(true);
    expect(richTextToPlain(item72.text as Parameters<typeof richTextToPlain>[0])).toContain("$990");
  });
});
