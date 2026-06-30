import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { sendApplicationApproved } from "@/lib/email";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("ADMIN");
  if (error) return error;

  const app = await prisma.agentApplication.findUnique({ where: { id: params.id } });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (app.status !== "PENDING") {
    return NextResponse.json({ error: "Application already processed" }, { status: 409 });
  }

  // Generate setup token (expires 72h)
  const setupToken = randomBytes(32).toString("hex");
  const setupTokenExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000);

  // Build slug from name — append random suffix to avoid collisions
  const baseSlug = `${app.firstName}-${app.lastName}`.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const slug = `${baseSlug}-${randomBytes(3).toString("hex")}`;

  // Temporary random password (agent will reset via setup link)
  const tempPassword = await bcrypt.hash(randomBytes(16).toString("hex"), 10);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: app.email,
        name: `${app.firstName} ${app.lastName}`,
        password: tempPassword,
        role: "AGENT",
        setupToken,
        setupTokenExpiry,
      },
    });

    await tx.agent.create({
      data: {
        userId: user.id,
        slug,
        displayName: `${app.firstName} ${app.lastName}`,
        phone: app.phone,
        licenseNum: app.licenseNumber,
        licenseState: "CA",
        yearsExp: app.yearsLicensed,
        specialties: app.specialties,
        bio: app.bio ?? undefined,
        instagram: app.instagramUrl ?? undefined,
        facebook: app.facebookUrl ?? undefined,
      },
    });

    await tx.agentApplication.update({
      where: { id: params.id },
      data: {
        status: "APPROVED",
        reviewedBy: session.user.email,
        reviewedAt: new Date(),
      },
    });
  });

  const setupUrl = `${process.env.NEXTAUTH_URL}/setup-account?token=${setupToken}`;
  sendApplicationApproved(app.email, app.firstName, setupUrl).catch(console.error);

  return NextResponse.json({ ok: true });
}
