import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPresignedGetUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  const agent = await prisma.agent.findUnique({
    where: { userId: params.userId },
    select: { headshot: true },
  });

  if (!agent?.headshot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = await getPresignedGetUrl(agent.headshot);
  const r2Res = await fetch(url);
  if (!r2Res.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const contentType = r2Res.headers.get("content-type") ?? "image/jpeg";
  return new Response(r2Res.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}
