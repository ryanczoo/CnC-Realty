import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const agent = await prisma.agent.findUnique({
    where: { userId: session.user.id },
    select: { bio: true, yearsExp: true, instagram: true, facebook: true, linkedin: true, headshot: true, propertiesRented: true },
  });
  return NextResponse.json(agent ?? {});
}

export async function PATCH(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const { bio, yearsExp, instagram, facebook, linkedin, headshot, propertiesRented } = body;

  const data: Record<string, unknown> = {};
  if (bio !== undefined) data.bio = bio || null;
  if (yearsExp !== undefined) data.yearsExp = yearsExp !== null ? Number(yearsExp) : null;
  if (instagram !== undefined) data.instagram = instagram || null;
  if (facebook !== undefined) data.facebook = facebook || null;
  if (linkedin !== undefined) data.linkedin = linkedin || null;
  if (headshot !== undefined) data.headshot = headshot || null;
  if (propertiesRented !== undefined) data.propertiesRented = Math.max(0, Number(propertiesRented) || 0);

  try {
    await prisma.agent.updateMany({
      where: { userId: session.user.id },
      data,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[agent-profile PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
