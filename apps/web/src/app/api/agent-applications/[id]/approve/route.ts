import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { sendApplicationApproved, sendApprovalDocuments } from "@/lib/email";
import { generateSignedIcaPdf } from "@/lib/ica-pdf";
import { uploadToR2 } from "@/lib/r2";
import { ICA_VERSION } from "@/lib/ica-content";
import { LISTING_PLACEHOLDER, TRANSFER_CHECKLIST_ITEM } from "@/lib/transfer-placeholder";

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
  const reviewedAt = new Date(); // also doubles as the broker countersignature timestamp below

  // The count columns are a nullable migration with no backfill, so an application
  // predating them can have the boolean set with a null count. Placeholder creation
  // and the transfer-form attachment must agree on exactly one condition, or an
  // agent gets a form telling them to upload to a locked file that was never made.
  const createsListingPlaceholders = Boolean(app.hasActiveListings && app.activeListingsCount);
  const createsSalePlaceholders = Boolean(app.hasActiveSales && app.activeSalesCount);

  try {
    await prisma.$transaction(async (tx) => {
      // Atomic PENDING → APPROVED status check + update
      const updated = await tx.agentApplication.updateMany({
        where: { id: params.id, status: "PENDING" },
        data: {
          status: "APPROVED",
          reviewedBy: adminEmail,
          reviewedAt,
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

      const agent = await tx.agent.create({
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

      if (createsListingPlaceholders) {
        for (let i = 0; i < app.activeListingsCount!; i++) {
          await tx.listingFile.create({
            data: {
              agentId: agent.id,
              status: "PENDING_TRANSFER",
              ...LISTING_PLACEHOLDER,
              checklistItems: {
                create: { fileType: "LISTING" as const, ...TRANSFER_CHECKLIST_ITEM },
              },
            },
          });
        }
      }

      if (createsSalePlaceholders) {
        for (let i = 0; i < app.activeSalesCount!; i++) {
          await tx.transactionFile.create({
            data: {
              agentId: agent.id,
              status: "PENDING_TRANSFER",
              transactionSide: "PURCHASE",
              checklistItems: {
                create: { fileType: "TRANSACTION" as const, ...TRANSFER_CHECKLIST_ITEM },
              },
            },
          });
        }
      }
    }, {
      // Up to 20 sequential creates (10 listings + 10 sales, the dropdown's max) run
      // inside this transaction on top of the user/agent creates. Prisma's 5s default
      // would intermittently roll back a whole approval under load or a cold compute.
      timeout: 15000,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_PROCESSED") {
      return NextResponse.json({ error: "Application already processed" }, { status: 409 });
    }
    throw err;
  }

  // Regenerate the executed ICA with a broker countersignature and overwrite the same R2
  // object in place — one PDF per agent, never a duplicate. If this fails, the agent's own
  // original signature is still on file and valid; we just log to Sentry rather than fail
  // an approval that has already succeeded.
  if (app.signedIcaKey) {
    try {
      const countersignedPdf = await generateSignedIcaPdf({
        signerName: app.signedName ?? `${app.firstName} ${app.lastName}`,
        signedAt: app.icaAgreedAt,
        signerIp: app.submissionIp,
        licenseNumber: app.licenseNumber,
        icaVersion: app.icaVersion ?? ICA_VERSION,
        brokerSignedAt: reviewedAt,
      });
      await uploadToR2(app.signedIcaKey, countersignedPdf, "application/pdf");
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  const setupUrl = `${process.env.NEXTAUTH_URL}/setup-account?token=${setupToken}`;
  sendApplicationApproved(app.email, app.firstName, setupUrl, slug).catch(console.error);
  sendApprovalDocuments(app.email, app.firstName, createsListingPlaceholders, createsSalePlaceholders).catch(console.error);

  return NextResponse.json({ ok: true });
}
