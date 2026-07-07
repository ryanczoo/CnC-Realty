import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getPresignedGetUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const agent = await prisma.agent.findUnique({
    where: { id: params.id },
    select: { signedIcaKey: true },
  });

  if (!agent?.signedIcaKey) {
    return NextResponse.json({ error: "No signed ICA on file" }, { status: 404 });
  }

  const url = await getPresignedGetUrl(agent.signedIcaKey);
  return NextResponse.json({ url });
}
