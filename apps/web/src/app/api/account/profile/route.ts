import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const agent = await prisma.agent.findUnique({
      where: { userId: session.user.id },
      select: { licenseNum: true, location: true, language: true },
    });
    return NextResponse.json(agent ?? {});
  } catch (err) {
    console.error("[profile GET] DB error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const { name, licenseNum, location, language } = body;

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: name.trim() },
      select: { id: true, name: true, email: true },
    });

    const agentData: Record<string, unknown> = {};
    if (licenseNum !== undefined) agentData.licenseNum = licenseNum.trim() || null;
    if (location !== undefined) agentData.location = location.trim() || null;
    if (language !== undefined) agentData.language = language.trim() || null;

    if (Object.keys(agentData).length > 0) {
      await prisma.agent.updateMany({
        where: { userId: session.user.id },
        data: agentData,
      });
    }

    return NextResponse.json({ user: updated });
  } catch (err) {
    console.error("[profile PATCH] DB error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
