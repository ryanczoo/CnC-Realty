import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendLeadReplyNotification } from "@/lib/action-plan-email";
import { isAuthorizedPostmarkWebhook } from "@/lib/postmark-webhook-auth";

export const dynamic = "force-dynamic";

const REPLY_PATTERN = /reply\+([a-z0-9]+)@reply\.cncrealtygroup\.com/i;

type InboundMail = {
  To?: string;
  OriginalRecipient?: string;
  MailboxHash?: string;
  Subject?: string;
  TextBody?: string;
  StrippedTextReply?: string;
};

// Postmark parses the part after `+` into MailboxHash for us. Falling back to
// the address keeps this working if plus-addressing is not configured on the
// inbound domain.
function enrollmentIdFrom(mail: InboundMail): string | null {
  if (mail.MailboxHash) return mail.MailboxHash;
  const address = mail.OriginalRecipient ?? mail.To ?? "";
  return REPLY_PATTERN.exec(address)?.[1] ?? null;
}

export async function POST(req: Request) {
  if (!isAuthorizedPostmarkWebhook(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Postmark posts JSON. SendGrid posted multipart form data — that is the
    // only part of this route that changes.
    const mail: InboundMail = await req.json();

    const enrollmentId = enrollmentIdFrom(mail);
    if (!enrollmentId) return NextResponse.json({ ok: true });

    const enrollment = await prisma.leadPlanEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { agent: { include: { user: { select: { email: true } } } } },
    });

    // Not ACTIVE means already handled. The agent replying to the forwarded
    // notification re-triggers this webhook, so this is the loop guard.
    if (!enrollment || enrollment.status !== "ACTIVE") {
      return NextResponse.json({ ok: true });
    }

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
      await sendLeadReplyNotification({
        to: agentEmail,
        subject: `[Lead Reply] ${mail.Subject ?? "(no subject)"}`,
        // StrippedTextReply drops the quoted original; without it the agent
        // gets the whole thread echoed back on every reply.
        body: mail.StrippedTextReply ?? mail.TextBody ?? "",
        enrollmentId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[postmark-inbound]", err);
    // Always 200 so Postmark does not retry the same payload forever.
    return NextResponse.json({ ok: true });
  }
}
