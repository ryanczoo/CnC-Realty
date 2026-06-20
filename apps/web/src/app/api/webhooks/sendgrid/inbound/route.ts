import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendActionPlanEmail } from "@/lib/action-plan-email";

export const dynamic = "force-dynamic";

const REPLY_PATTERN = /reply\+([a-z0-9]+)@reply\.cncrealtygroup\.com/i;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const to = form.get("to")?.toString() ?? "";
    const subject = form.get("subject")?.toString() ?? "(no subject)";
    const text = form.get("text")?.toString() ?? "";

    const match = REPLY_PATTERN.exec(to);
    if (!match) return NextResponse.json({ ok: true });

    const enrollmentId = match[1];
    const enrollment = await prisma.leadPlanEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { agent: { include: { user: { select: { email: true } } } } },
    });

    if (!enrollment || enrollment.status !== "ACTIVE") return NextResponse.json({ ok: true });

    await prisma.leadPlanEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "PAUSED", pausedAt: new Date(), pausedReason: "REPLY" },
    });

    await prisma.leadPlanStep.updateMany({
      where: { enrollmentId, status: "PENDING" },
      data: { status: "PAUSED" },
    });

    const agentEmail = enrollment.agent?.user?.email;
    if (agentEmail) {
      // sendActionPlanEmail sets replyTo=reply+{enrollmentId}@... — if the agent
      // accidentally replies to the forwarded email, this webhook fires again but the
      // enrollment is already PAUSED, so it no-ops safely.
      await sendActionPlanEmail({
        to: agentEmail,
        subject: `[Lead Reply] ${subject}`,
        body: text,
        enrollmentId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[sendgrid-inbound]", e);
    return NextResponse.json({ ok: true }); // Always 200 to stop SendGrid retries
  }
}
