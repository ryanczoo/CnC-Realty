// apps/web/src/__tests__/lib/ica-pdf.test.ts
import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generateSignedIcaPdf } from "@/lib/ica-pdf";

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
