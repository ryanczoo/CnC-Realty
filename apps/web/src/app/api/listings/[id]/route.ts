import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOwnership, assertFileEditable } from "@/lib/api-auth";
import { changeFileStatus } from "@/lib/file-status";
import { FILE_DETAIL_INCLUDE } from "@/lib/transaction-helpers";
import { trimStrings } from "@/lib/form-validation";
import { listingDatesError } from "@/lib/listing-dates";
import { requiredFieldError, commissionPercentError, commissionLockedError } from "@/lib/file-edit";
import { logCommissionChanges } from "@/lib/commission-log";
import { followDates } from "@/lib/auto-status";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // convertedFiles: the latest transaction made from this listing, for the
  // "View Transaction" link on an Under Contract listing.
  const listing = await prisma.listingFile.findUnique({
    where: { id: params.id },
    include: { ...FILE_DETAIL_INCLUDE, convertedFiles: { select: { id: true, status: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
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

  const body = trimStrings(await req.json());
  const role = isAdmin ? "ADMIN" : "AGENT";
  const commissionLocked = commissionLockedError("listing", body, listing, role);
  if (commissionLocked) return NextResponse.json({ error: commissionLocked }, { status: 403 });
  const required = requiredFieldError("listing", body, listing) ?? commissionPercentError(body);
  if (required) return NextResponse.json({ error: required }, { status: 400 });

  // Only validated when this edit touches a date, so older listings created
  // before dates were required can still have other fields edited.
  if (body.listDate !== undefined || body.expirationDate !== undefined) {
    const datesError = listingDatesError(
      body.listDate !== undefined ? body.listDate : listing.listDate,
      body.expirationDate !== undefined ? body.expirationDate : listing.expirationDate,
    );
    if (datesError) return NextResponse.json({ error: datesError }, { status: 400 });
  }

  const fieldData = {
    ...(body.propertyAddress !== undefined && { propertyAddress: body.propertyAddress }),
    ...(body.city !== undefined && { city: body.city }),
    ...(body.zip !== undefined && { zip: body.zip }),
    ...(body.listPrice !== undefined && { listPrice: parseFloat(body.listPrice) }),
    ...(body.mlsNumber !== undefined && { mlsNumber: body.mlsNumber || null }),
    ...(body.expirationDate !== undefined && { expirationDate: body.expirationDate ? new Date(body.expirationDate) : null }),
    ...(body.listDate !== undefined && { listDate: body.listDate ? new Date(body.listDate) : null }),
    ...(body.commissionPercent !== undefined && { commissionPercent: body.commissionPercent ? parseFloat(body.commissionPercent) : null }),
    ...(body.commissionAmount !== undefined && { commissionAmount: body.commissionAmount ? parseFloat(body.commissionAmount) : null }),
    ...(body.commissionNotes !== undefined && { commissionNotes: body.commissionNotes || null }),
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
    await logCommissionChanges("listing", params.id, listing, result.file, { userId: session.user.id, role });
    return NextResponse.json({ listing: result.file, ...(result.emailWarning && { emailWarning: true }) });
  }

  const updated = await prisma.listingFile.update({ where: { id: params.id }, data: fieldData });
  await logCommissionChanges("listing", params.id, listing, updated, { userId: session.user.id, role });
  // A saved date can move the status (e.g. an extended Expired listing -> Active).
  await followDates("listing", params.id, { userId: session.user.id, role });
  return NextResponse.json({ listing: updated });
}

// Broker-only, and only for an empty listing: a file that holds documents (or
// became a transaction) is part of the 3-year record B&P §10148 requires — it
// gets Withdrawn or Canceled instead, never deleted.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const listing = await prisma.listingFile.findUnique({
    where: { id: params.id },
    include: { _count: { select: { documents: true, convertedFiles: true } } },
  });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (listing._count.documents > 0) {
    return NextResponse.json({ error: "Delete this listing's documents first" }, { status: 400 });
  }
  if (listing._count.convertedFiles > 0) {
    return NextResponse.json({ error: "This listing was converted to a transaction and can't be deleted" }, { status: 400 });
  }

  await prisma.listingFile.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
