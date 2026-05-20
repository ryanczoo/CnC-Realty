import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function POST(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = session.user.id;

  let body: {
    displayName?: string;
    phone?: string;
    email?: string;
    bio?: string;
    licenseNum?: string;
    yearsExp?: number | null;
    specialties?: string[];
    instagramUrl?: string;
    facebookUrl?: string;
    linkedinUrl?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { displayName, phone, email, bio, licenseNum, yearsExp, specialties, instagramUrl, facebookUrl, linkedinUrl } = body;

  if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
    return NextResponse.json({ error: "displayName is required" }, { status: 400 });
  }

  const slug =
    displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Date.now().toString(36);

  try {
    const agentData = {
      bio: bio ?? null,
      phone: phone ?? null,
      licenseNum: licenseNum ?? null,
      displayName: displayName.trim(),
      yearsExp: yearsExp ?? null,
      specialties: specialties ?? [],
      instagram: instagramUrl ?? null,
      facebook: facebookUrl ?? null,
      linkedin: linkedinUrl ?? null,
    };

    const [agent] = await prisma.$transaction([
      prisma.agent.upsert({
        where: { userId },
        create: { userId, slug, ...agentData },
        update: agentData,
      }),
      prisma.user.update({
        where: { id: userId },
        data: { role: "AGENT" },
      }),
    ]);

    return NextResponse.json({ success: true, slug: agent.slug });
  } catch (err) {
    console.error("[agent-onboarding] DB error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
