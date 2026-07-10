import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const schema = z.object({
  name: z.string().min(1),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]),
  })),
});

export async function GET() {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  if (!session.user.agentId) return NextResponse.json([]);

  const lists = await prisma.smartList.findMany({
    where: { agentId: session.user.agentId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(lists);
}

export async function POST(req: Request) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const agentId = session.user.agentId;
  if (!agentId) return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });

  try {
    const body = schema.parse(await req.json());
    const list = await prisma.smartList.create({
      data: { agentId, name: body.name, filters: body.filters },
    });
    return NextResponse.json(list, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
