import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPresignedGetUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tx = await prisma.transactionFile.findUnique({
    where: { id: params.id },
    select: { agentId: true, photoKey: true },
  });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.user.role !== "ADMIN" && tx.agentId !== session.user.agentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!tx.photoKey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = await getPresignedGetUrl(tx.photoKey);
  const r2Res = await fetch(url);
  if (!r2Res.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const contentType = r2Res.headers.get("content-type") ?? "image/jpeg";
  return new Response(r2Res.body, {
    headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
  });
}
