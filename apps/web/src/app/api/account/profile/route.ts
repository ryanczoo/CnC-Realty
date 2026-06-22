import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const agent = await prisma.agent.findUnique({
      where: { userId: session.user.id },
      select: { licenseNum: true },
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
  const { name, licenseNum } = body;

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: name.trim() },
      select: { id: true, name: true, email: true },
    });

    if (licenseNum !== undefined) {
      await prisma.agent.updateMany({
        where: { userId: session.user.id },
        data: { licenseNum: licenseNum.trim() || null },
      });
    }

    return NextResponse.json({ user: updated });
  } catch (err) {
    console.error("[profile PATCH] DB error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
