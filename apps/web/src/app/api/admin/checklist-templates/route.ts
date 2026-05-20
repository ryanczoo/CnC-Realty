import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function adminGuard(session: Awaited<ReturnType<typeof getServerSession<typeof authOptions>>>) {
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const err = adminGuard(session);
  if (err) return err;

  const templates = await prisma.checklistTemplate.findMany({
    include: { items: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const err = adminGuard(session);
  if (err) return err;

  const { name, fileType, transactionSide, listingType } = await req.json();
  if (!name || !fileType) return NextResponse.json({ error: "name and fileType are required" }, { status: 400 });

  const template = await prisma.checklistTemplate.create({
    data: { name, fileType, transactionSide: transactionSide ?? "ALL", listingType: listingType ?? "ALL" },
  });

  return NextResponse.json({ template }, { status: 201 });
}
