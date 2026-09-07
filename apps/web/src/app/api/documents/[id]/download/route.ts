import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPresignedGetUrl } from "@/lib/r2";
import { getFileAndVerifyAccess } from "@/lib/api-auth";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await prisma.fileDocument.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fileId = doc.listingFileId ?? doc.transactionFileId;
  const fileType: "listing" | "transaction" = doc.listingFileId ? "listing" : "transaction";
  if (!fileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const file = await getFileAndVerifyAccess(fileType, fileId, session.user.agentId, session.user.role);
  if (!file) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = await getPresignedGetUrl(doc.r2Key);
  return NextResponse.json({ url });
}
