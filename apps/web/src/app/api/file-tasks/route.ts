import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fileType = searchParams.get("fileType");
  const fileId = searchParams.get("fileId");
  if (!fileType || !fileId) return NextResponse.json({ error: "fileType and fileId required" }, { status: 400 });

  if (fileType !== "listing" && fileType !== "transaction") {
    return NextResponse.json({ error: "fileType must be 'listing' or 'transaction'" }, { status: 400 });
  }

  const tasks = await prisma.fileTask.findMany({
    where: fileType === "listing" ? { listingFileId: fileId } : { transactionFileId: fileId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { fileType: string; fileId: string; title: string; dueDate?: string; assigneeName?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { fileType, fileId, title, dueDate, assigneeName } = body;
  if (!fileId || !title?.trim()) {
    return NextResponse.json({ error: "fileType, fileId, and title are required" }, { status: 400 });
  }
  if (fileType !== "listing" && fileType !== "transaction") {
    return NextResponse.json({ error: "fileType must be 'listing' or 'transaction'" }, { status: 400 });
  }

  const task = await prisma.fileTask.create({
    data: {
      fileType: fileType === "listing" ? "LISTING" : "TRANSACTION",
      ...(fileType === "listing" ? { listingFileId: fileId } : { transactionFileId: fileId }),
      title: title.trim(),
      dueDate: dueDate ? new Date(dueDate) : null,
      assigneeName: assigneeName?.trim() || null,
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}
