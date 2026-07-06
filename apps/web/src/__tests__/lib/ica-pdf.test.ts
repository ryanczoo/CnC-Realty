// apps/web/src/__tests__/lib/ica-pdf.test.ts
import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generateSignedIcaPdf, tokenizeRichText } from "@/lib/ica-pdf";

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
