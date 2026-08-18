import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const { title, monthlyEmailLimit } = body as { title?: unknown; monthlyEmailLimit?: unknown };

  const data: { title?: string; monthlyEmailLimit?: number } = {};

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    data.title = title.trim();
  }

  if (monthlyEmailLimit !== undefined) {
    if (typeof monthlyEmailLimit !== "number" || !Number.isInteger(monthlyEmailLimit) || monthlyEmailLimit < 0) {
      return NextResponse.json(
        { error: "Monthly email limit must be a non-negative integer" },
        { status: 400 }
      );
    }
    data.monthlyEmailLimit = monthlyEmailLimit;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const agent = await prisma.agent
    .update({
      where: { id: params.id },
      data,
      select: { id: true, title: true, monthlyEmailLimit: true },
    })
    .catch(() => null);

  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  return NextResponse.json(agent);
}
