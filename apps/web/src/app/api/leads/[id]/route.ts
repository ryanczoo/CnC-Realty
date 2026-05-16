import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const patchSchema = z.object({
  status: z
    .enum([
      "NEW",
      "CONTACTED",
      "QUALIFIED",
      "SHOWING",
      "OFFER",
      "UNDER_CONTRACT",
      "CLOSED",
      "LOST",
    ])
    .optional(),
  notes: z.string().optional(),
  score: z.number().int().min(0).max(100).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { error } = await requireAuth("AGENT");
  if (error) return error;

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: { activities: { orderBy: { createdAt: "desc" } } },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(lead);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { error } = await requireAuth("AGENT");
  if (error) return error;

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const lead = await prisma.lead.update({ where: { id: params.id }, data });
    return NextResponse.json(lead);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
