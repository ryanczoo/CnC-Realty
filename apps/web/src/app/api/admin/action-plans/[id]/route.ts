import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function isNotFound(err: unknown): boolean {
  return (err as any)?.code === "P2025";
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const schema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
  });
  try {
    const data = schema.parse(await req.json());
    const plan = await prisma.actionPlan.update({ where: { id: params.id }, data });
    return NextResponse.json(plan);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    if (isNotFound(err)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const activeCount = await prisma.leadPlanEnrollment.count({
    where: { planId: params.id, status: "ACTIVE" },
  });
  if (activeCount > 0) {
    return NextResponse.json({ error: "Cannot delete plan with active enrollments" }, { status: 409 });
  }
  try {
    await prisma.actionPlan.delete({ where: { id: params.id } });
  } catch (err) {
    if (isNotFound(err)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
