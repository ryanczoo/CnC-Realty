import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getFileAndVerifyAccess(fileType: string, fileId: string, userId: string, userRole: string) {
  if (fileType === "listing") {
    const file = await prisma.listingFile.findUnique({ where: { id: fileId } });
    if (!file) return null;
    if (userRole !== "ADMIN") {
      const agent = await prisma.agent.findUnique({ where: { userId } });
      if (file.agentId !== agent?.id) return null;
    }
    return file;
  } else {
    const file = await prisma.transactionFile.findUnique({ where: { id: fileId } });
    if (!file) return null;
    if (userRole !== "ADMIN") {
      const agent = await prisma.agent.findUnique({ where: { userId } });
      if (file.agentId !== agent?.id) return null;
    }
    return file;
  }
}

export async function POST(req: Request, { params }: { params: { fileType: string; id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const file = await getFileAndVerifyAccess(params.fileType, params.id, session.user.id, session.user.role);
  if (!file) return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });

  const body = await req.json();
  const { role, name, email, phone, company, licenseNumber } = body;
  if (!role || !name) return NextResponse.json({ error: "role and name are required" }, { status: 400 });

  const isListing = params.fileType === "listing";
  const party = await prisma.fileParty.create({
    data: {
      fileType: isListing ? "LISTING" : "TRANSACTION",
      listingFileId: isListing ? params.id : null,
      transactionFileId: isListing ? null : params.id,
      role, name,
      email: email ?? null,
      phone: phone ?? null,
      company: company ?? null,
      licenseNumber: licenseNumber ?? null,
    },
  });

  await prisma.fileActivity.create({
    data: {
      fileType: isListing ? "LISTING" : "TRANSACTION",
      listingFileId: isListing ? params.id : null,
      transactionFileId: isListing ? null : params.id,
      actorId: session.user.id,
      actorRole: session.user.role === "ADMIN" ? "ADMIN" : "AGENT",
      type: "PARTY_ADDED",
      payload: { partyId: party.id, role, name },
    },
  });

  return NextResponse.json({ party }, { status: 201 });
}
