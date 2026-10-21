import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOwnership } from "@/lib/api-auth";
import { getR2ObjectBuffer } from "@/lib/r2";

export const dynamic = "force-dynamic";

// A listing or transaction file's property photo (the header photo). The file's
// own agent or the broker only. Photos can't change once the file is created,
// so the browser may keep it for an hour.
export async function GET(_req: Request, { params }: { params: { fileType: string; id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (params.fileType !== "listing" && params.fileType !== "transaction") {
    return NextResponse.json({ error: "fileType must be 'listing' or 'transaction'" }, { status: 400 });
  }
  const select = { agentId: true, photoKey: true } as const;
  const file = params.fileType === "listing"
    ? await prisma.listingFile.findUnique({ where: { id: params.id }, select })
    : await prisma.transactionFile.findUnique({ where: { id: params.id }, select });
  const { exists, forbidden } = checkOwnership(file, session.user.agentId, session.user.role);
  if (!exists || forbidden || !file?.photoKey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await getR2ObjectBuffer(file.photoKey);
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
}
