// apps/web/src/app/api/campaigns/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const createSchema = z.object({
  name: z.string().min(1, "Name required"),
  type: z.enum(["EMAIL", "DRIP"]),
  subject: z.string().optional(),
});

export async function GET() {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  if (!session.user.agentId) return NextResponse.json([]);

  const campaigns = await prisma.campaign.findMany({
    where: { agentId: session.user.agentId },
    include: { _count: { select: { contacts: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const agentId = session.user.agentId;

  if (!agentId) {
    return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        type: data.type,
        subject: data.subject ?? null,
        body: "",
        status: "DRAFT",
        agentId,
      },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
