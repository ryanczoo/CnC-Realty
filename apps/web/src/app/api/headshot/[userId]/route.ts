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
  return NextResponse.redirect(url);
}
