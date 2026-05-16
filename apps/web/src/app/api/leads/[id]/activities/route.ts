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
  const { error } = await requireAuth("AGENT");
  if (error) return error;

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const activity = await prisma.activity.create({
      data: { ...data, leadId: params.id },
    });
    return NextResponse.json(activity, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
