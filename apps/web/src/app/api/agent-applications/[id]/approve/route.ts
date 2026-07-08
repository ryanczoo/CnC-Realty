import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { sendApplicationApproved, sendApprovalDocuments } from "@/lib/email";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("ADMIN");
  if (error) return error;

  const adminEmail = session.user?.email;
  if (!adminEmail) {
    return NextResponse.json({ error: "Admin email required" }, { status: 400 });
  }

  const app = await prisma.agentApplication.findUnique({ where: { id: params.id } });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Generate setup token (does not expire)
  const setupToken = randomBytes(32).toString("hex");

  // Build slug from name — append random suffix to avoid collisions
  const baseSlug = `${app.firstName}-${app.lastName}`.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const slug = `${baseSlug}-${randomBytes(3).toString("hex")}`;

  // Temporary random password (agent will reset via setup link)
  const tempPassword = await bcrypt.hash(randomBytes(16).toString("hex"), 10);

  try {
    await prisma.$transaction(async (tx) => {
      // Atomic PENDING → APPROVED status check + update
      const updated = await tx.agentApplication.updateMany({
        where: { id: params.id, status: "PENDING" },
        data: {
          status: "APPROVED",
          reviewedBy: adminEmail,
          reviewedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        throw new Error("ALREADY_PROCESSED");
      }

      const user = await tx.user.create({
        data: {
          email: app.email,
          name: `${app.firstName} ${app.lastName}`,
          password: tempPassword,
          role: "AGENT",
          setupToken,
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
          signedIcaKey: app.signedIcaKey,
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_PROCESSED") {
      return NextResponse.json({ error: "Application already processed" }, { status: 409 });
    }
    throw err;
  }

  const setupUrl = `${process.env.NEXTAUTH_URL}/setup-account?token=${setupToken}`;
  sendApplicationApproved(app.email, app.firstName, setupUrl).catch(console.error);
  sendApprovalDocuments(app.email, app.firstName).catch(console.error);

  return NextResponse.json({ ok: true });
}
