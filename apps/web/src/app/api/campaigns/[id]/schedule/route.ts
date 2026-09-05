import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, checkOwnership } from "@/lib/api-auth";

const scheduleSchema = z.object({
  sendNow: z.boolean(),
  scheduledAt: z.string().datetime().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const existing = await prisma.campaign.findUnique({
    where: { id: params.id },
    select: { id: true, agentId: true },
  });
  const { exists, forbidden } = checkOwnership(existing, session.user.agentId, session.user.role);
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let data: z.infer<typeof scheduleSchema>;
  try {
    data = scheduleSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      contacts: { select: { id: true } },
      steps: { orderBy: { stepOrder: "asc" }, select: { id: true, delayDays: true } },
    },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Idempotency guard: this endpoint only ever runs once per campaign. A
  // second call (double-submit, network retry) cannot re-materialize
  // duplicate deliveries, because the first successful call always advances
  // status past DRAFT before a second one could run.
  if (campaign.status !== "DRAFT") {
    return NextResponse.json({ error: "Campaign has already been scheduled" }, { status: 400 });
  }

  if (campaign.contacts.length === 0) {
    return NextResponse.json({ error: "Campaign has no contacts" }, { status: 400 });
  }
  if (campaign.type === "DRIP" && campaign.steps.length === 0) {
    return NextResponse.json({ error: "DRIP campaign has no steps" }, { status: 400 });
  }

  let startTime: Date;
  if (data.sendNow) {
    startTime = new Date();
  } else {
    if (!data.scheduledAt) {
      return NextResponse.json({ error: "scheduledAt is required when sendNow is false" }, { status: 400 });
    }
    startTime = new Date(data.scheduledAt);
    if (startTime.getTime() <= Date.now()) {
      return NextResponse.json({ error: "scheduledAt must be in the future" }, { status: 400 });
    }
  }

  const rows: { campaignContactId: string; dripStepId: string | null; dueAt: Date }[] = [];

  if (campaign.type === "DRIP") {
    // Cumulative from the previous step, not from startTime directly — see
    // the design spec's "Resolved ambiguity" section. Computed once per step
    // order, then crossed with every contact.
    let runningDueAt = startTime;
    const stepDueAts: { id: string; dueAt: Date }[] = [];
    for (const step of campaign.steps) {
      runningDueAt = new Date(runningDueAt.getTime() + step.delayDays * 24 * 60 * 60 * 1000);
      stepDueAts.push({ id: step.id, dueAt: runningDueAt });
    }
    for (const contact of campaign.contacts) {
      for (const step of stepDueAts) {
        rows.push({ campaignContactId: contact.id, dripStepId: step.id, dueAt: step.dueAt });
      }
    }
  } else {
    for (const contact of campaign.contacts) {
      rows.push({ campaignContactId: contact.id, dripStepId: null, dueAt: startTime });
    }
  }

  await prisma.campaignDelivery.createMany({ data: rows });

  await prisma.campaign.update({
    where: { id: params.id },
    data: data.sendNow
      ? { status: "ACTIVE", sentAt: startTime }
      : { status: "SCHEDULED" },
  });

  return NextResponse.json({ ok: true });
}
