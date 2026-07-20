import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOwnership } from "@/lib/api-auth";
import { canTransitionListing, FILE_DETAIL_INCLUDE } from "@/lib/transaction-helpers";
import { sendFileClosed } from "@/lib/email/transaction-emails";

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

  const body = await req.json();
  const role = isAdmin ? "ADMIN" : "AGENT";

  if (body.status && body.status !== listing.status) {
    if (!canTransitionListing(listing.status, body.status, role)) {
      return NextResponse.json({ error: `Cannot transition from ${listing.status} to ${body.status}` }, { status: 400 });
    }
  }

  const updated = await prisma.listingFile.update({
    where: { id: params.id },
    data: {
      ...(body.propertyAddress !== undefined && { propertyAddress: body.propertyAddress }),
      ...(body.city !== undefined && { city: body.city }),
      ...(body.zip !== undefined && { zip: body.zip }),
      ...(body.listPrice !== undefined && { listPrice: parseFloat(body.listPrice) }),
      ...(body.mlsNumber !== undefined && { mlsNumber: body.mlsNumber }),
      ...(body.expirationDate !== undefined && { expirationDate: body.expirationDate ? new Date(body.expirationDate) : null }),
      ...(body.listDate !== undefined && { listDate: body.listDate ? new Date(body.listDate) : null }),
      ...(body.commissionPercent !== undefined && { commissionPercent: body.commissionPercent ? parseFloat(body.commissionPercent) : null }),
      ...(body.commissionNotes !== undefined && { commissionNotes: body.commissionNotes }),
      ...(body.status !== undefined && { status: body.status }),
    },
  });

  if (body.status && body.status !== listing.status) {
    await prisma.fileActivity.create({
      data: {
        fileType: "LISTING",
        listingFileId: params.id,
        actorId: session.user.id,
        actorRole: role,
        type: "STATUS_CHANGED",
        payload: { from: listing.status, to: body.status },
      },
    });

    if (body.status === "CLOSED") {
      const agentRecord = await prisma.agent.findUnique({ where: { id: listing.agentId }, include: { user: true } });
      if (agentRecord?.user) {
        await sendFileClosed({ agentEmail: agentRecord.user.email, agentName: agentRecord.user.name ?? "Agent", address: listing.propertyAddress, fileType: "listing", fileId: params.id });
      }
    }
  }

  return NextResponse.json({ listing: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listing = await prisma.listingFile.findUnique({ where: { id: params.id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (listing.status !== "INCOMPLETE") {
    return NextResponse.json({ error: "Only INCOMPLETE files can be deleted" }, { status: 400 });
  }

  const { forbidden } = checkOwnership(listing, session.user.agentId, session.user.role);
  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.listingFile.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
