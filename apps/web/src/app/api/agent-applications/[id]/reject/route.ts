import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { sendApplicationRejected } from "@/lib/email";

const schema = z.object({
  reason: z.string().min(1, "Rejection reason required"),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("ADMIN");
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const app = await prisma.agentApplication.findUnique({ where: { id: params.id } });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (app.status !== "PENDING") {
    return NextResponse.json({ error: "Application already processed" }, { status: 409 });
  }

  await prisma.agentApplication.update({
    where: { id: params.id },
    data: {
      status: "REJECTED",
      rejectionReason: parsed.data.reason,
      reviewedBy: session.user.email,
      reviewedAt: new Date(),
    },
  });

  sendApplicationRejected(app.email, app.firstName, parsed.data.reason).catch(console.error);

  return NextResponse.json({ ok: true });
}
