import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { requireAuth } from "@/lib/api-auth";
import { ATTACHMENTS_DIR } from "@/lib/email";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const bytes = readFileSync(join(ATTACHMENTS_DIR, "w9-blank.pdf"));
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="CnC Realty - W-9 Form.pdf"`,
    },
  });
}
