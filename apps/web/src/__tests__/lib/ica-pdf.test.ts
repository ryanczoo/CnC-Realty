// apps/web/src/__tests__/lib/ica-pdf.test.ts
import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
// pdf-parse's package-root index.js has a debug-mode bug that runs unconditionally
// on require; importing the internal module directly bypasses it.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { generateSignedIcaPdf, tokenizeRichText, wrapText, CONTENT_WIDTH } from "@/lib/ica-pdf";
import { SUMMARY_TABLE, BROKER_NAME } from "@/lib/ica-content";

const BASE_INPUT = {
  signerName: "Jane Smith",
  signedAt: new Date("2026-07-06T12:00:00.000Z"),
  signerIp: "1.2.3.4",
  licenseNumber: "01234567",
  icaVersion: "2026-07-06",
};

describe("generateSignedIcaPdf", () => {
  it("produces a valid multi-page PDF containing the signature block", async () => {
    const buffer = await generateSignedIcaPdf(BASE_INPUT);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");

    const loaded = await PDFDocument.load(buffer);
    expect(loaded.getPageCount()).toBeGreaterThan(5);
  });

  it("includes the associate-licensee's DRE license number in the signature block", async () => {
    const buffer = await generateSignedIcaPdf(BASE_INPUT);
    const { text } = await pdfParse(buffer);
    expect(text).toContain("01234567");
  });

  it("stamps the ICA version that was passed in, not whatever the live constant currently is", async () => {
    const buffer = await generateSignedIcaPdf({ ...BASE_INPUT, icaVersion: "2025-01-01-old-version" });
    const { text } = await pdfParse(buffer);
    expect(text).toContain("2025-01-01-old-version");
  });

  it("omits the broker countersignature block when brokerSignedAt is not provided", async () => {
    const buffer = await generateSignedIcaPdf(BASE_INPUT);
    const { text } = await pdfParse(buffer);
    expect(text).not.toContain("Countersigned");
  });

  it("renders the broker countersignature block when brokerSignedAt is provided", async () => {
    const brokerSignedAt = new Date("2026-07-10T09:30:00.000Z");
    const buffer = await generateSignedIcaPdf({ ...BASE_INPUT, brokerSignedAt });
    const { text } = await pdfParse(buffer);
    expect(text).toContain("Countersigned");
    expect(text).toContain(BROKER_NAME);
    expect(text).toContain(brokerSignedAt.toISOString());
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
