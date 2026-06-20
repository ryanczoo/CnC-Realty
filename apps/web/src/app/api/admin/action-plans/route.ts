import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const plans = await prisma.actionPlan.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { steps: true } } },
  });
  return NextResponse.json(
    plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      isActive: p.isActive,
      stepCount: p._count.steps,
      createdAt: p.createdAt,
    }))
  );
}

export async function POST(req: Request) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const schema = z.object({ name: z.string().min(1), description: z.string().optional() });
  try {
    const data = schema.parse(await req.json());
    const plan = await prisma.actionPlan.create({ data });
    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
