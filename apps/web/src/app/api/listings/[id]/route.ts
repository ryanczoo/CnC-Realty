import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOwnership, assertFileEditable } from "@/lib/api-auth";
import { changeFileStatus } from "@/lib/file-status";
import { FILE_DETAIL_INCLUDE } from "@/lib/transaction-helpers";
import { deleteR2Object } from "@/lib/r2";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listing = await prisma.listingFile.findUnique({ where: { id: params.id }, include: FILE_DETAIL_INCLUDE });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { forbidden } = checkOwnership(listing, session.user.agentId, session.user.role);
  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ listing });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listing = await prisma.listingFile.findUnique({ where: { id: params.id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.role === "ADMIN";
  const { forbidden } = checkOwnership(listing, session.user.agentId, session.user.role);
  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const locked = assertFileEditable("listing", listing.status, session.user.role);
  if (locked) return locked;

  const body = await req.json();
  const role = isAdmin ? "ADMIN" : "AGENT";

  const fieldData = {
    ...(body.propertyAddress !== undefined && { propertyAddress: body.propertyAddress }),
    ...(body.city !== undefined && { city: body.city }),
    ...(body.zip !== undefined && { zip: body.zip }),
    ...(body.listPrice !== undefined && { listPrice: parseFloat(body.listPrice) }),
    ...(body.mlsNumber !== undefined && { mlsNumber: body.mlsNumber }),
    ...(body.expirationDate !== undefined && { expirationDate: body.expirationDate ? new Date(body.expirationDate) : null }),
    ...(body.listDate !== undefined && { listDate: body.listDate ? new Date(body.listDate) : null }),
    ...(body.commissionPercent !== undefined && { commissionPercent: body.commissionPercent ? parseFloat(body.commissionPercent) : null }),
    ...(body.commissionNotes !== undefined && { commissionNotes: body.commissionNotes }),
  };

  if (body.status && body.status !== listing.status) {
    const result = await changeFileStatus({
      kind: "listing",
      fileId: params.id,
      toStatus: body.status,
      actor: { userId: session.user.id, role },
      extraData: fieldData,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ listing: result.file, ...(result.emailWarning && { emailWarning: true }) });
  }

  const updated = await prisma.listingFile.update({ where: { id: params.id }, data: fieldData });
  return NextResponse.json({ listing: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listing = await prisma.listingFile.findUnique({ where: { id: params.id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (listing.status !== "INCOMPLETE" && listing.status !== "PENDING_TRANSFER") {
    return NextResponse.json({ error: "Only INCOMPLETE or PENDING_TRANSFER files can be deleted" }, { status: 400 });
  }

  const { forbidden } = checkOwnership(listing, session.user.agentId, session.user.role);
  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documents = await prisma.fileDocument.findMany({
    where: { listingFileId: params.id },
    select: { r2Key: true },
  });
  await Promise.all(
    documents.map((doc) =>
      deleteR2Object(doc.r2Key).catch((err) => console.error(`Failed to delete R2 object ${doc.r2Key}:`, err))
    )
  );

  await prisma.listingFile.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
