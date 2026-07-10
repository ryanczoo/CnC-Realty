// apps/web/src/__tests__/lib/ica-pdf.test.ts
import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { generateSignedIcaPdf, tokenizeRichText, wrapText, CONTENT_WIDTH } from "@/lib/ica-pdf";
import { SUMMARY_TABLE } from "@/lib/ica-content";

describe("generateSignedIcaPdf", () => {
  it("produces a valid multi-page PDF containing the signature block", async () => {
    const buffer = await generateSignedIcaPdf({
      signerName: "Jane Smith",
      signedAt: new Date("2026-07-06T12:00:00.000Z"),
      signerIp: "1.2.3.4",
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");

    const loaded = await PDFDocument.load(buffer);
    expect(loaded.getPageCount()).toBeGreaterThan(5);
  });
});

describe("wrapText — two-column table cells", () => {
  it("wraps a long Fee Schedule Summary cell to fit within its column instead of overflowing", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const colWidth = CONTENT_WIDTH / SUMMARY_TABLE.headers.length;

    const longRow = SUMMARY_TABLE.rows.find((r) => r[0].startsWith("E&O Supplement examples"));
    expect(longRow).toBeDefined();

    const lines = wrapText(longRow![0], font, 10, colWidth);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, 10)).toBeLessThanOrEqual(colWidth);
    }
  });
});

describe("tokenizeRichText", () => {
  it("does not insert a space when a bold run abuts punctuation with no whitespace", () => {
    const tokens = tokenizeRichText(["is ", { bold: "$990" }, ", inclusive"]);
    const dollarToken = tokens.find((t) => t.word === "$990")!;
    const commaToken = tokens.find((t) => t.word === ",")!;
    expect(dollarToken.bold).toBe(true);
    expect(dollarToken.spaceBefore).toBe(true); // "is " ends with a space
    expect(commaToken.bold).toBe(false);
    expect(commaToken.spaceBefore).toBe(false); // "$990" has no trailing space, "," has no leading space
  });

  it("does not insert a space between a bold run and an immediately-following period", () => {
    const tokens = tokenizeRichText([
      "made between ",
      { bold: "Associate-Licensee" },
      ". In consideration",
    ]);
    const periodToken = tokens.find((t) => t.word === ".")!;
    expect(periodToken.spaceBefore).toBe(false);
  });

  it("still spaces normal words within a single run", () => {
    const tokens = tokenizeRichText("plain text with several words");
    expect(tokens.every((t, i) => (i === 0 ? true : t.spaceBefore))).toBe(true);
  });
});
