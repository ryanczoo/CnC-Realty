import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const schema = z.object({
  type: z
    .enum(["NOTE", "CALL", "EMAIL", "SHOWING", "OFFER", "DOCUMENT"])
    .default("NOTE"),
  content: z.string().min(1, "Content required"),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { id: userId, role } = session.user;

  if (role !== "ADMIN") {
    const agent = await prisma.agent.findUnique({ where: { userId } });
    const lead = await prisma.lead.findUnique({ where: { id: params.id }, select: { agentId: true } });
    if (!agent || !lead || lead.agentId !== agent.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const [activity] = await Promise.all([
      prisma.activity.create({
        data: { ...data, leadId: params.id },
      }),
      prisma.lead.update({
        where: { id: params.id },
        data: { lastContactedAt: new Date() },
      }),
    ]);
    return NextResponse.json(activity, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
