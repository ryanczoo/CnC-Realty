import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { requireAuth } from "@/lib/api-auth";
import { ATTACHMENTS_DIR } from "@/lib/email";

const FILES: Record<string, { file: string; downloadName: string }> = {
  listing: { file: "listing-transfer-authorization.pdf", downloadName: "CnC Realty - Listing Transfer Authorization.pdf" },
  "pending-sale": { file: "pending-sale-transfer-authorization.pdf", downloadName: "CnC Realty - Pending Sale Transfer Authorization.pdf" },
};

export async function GET(_req: Request, { params }: { params: { type: string } }) {
  const { error } = await requireAuth();
  if (error) return error;

  const entry = FILES[params.type];
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bytes = readFileSync(join(ATTACHMENTS_DIR, entry.file));
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${entry.downloadName}"`,
    },
  });
}
