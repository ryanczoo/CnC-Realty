import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const tags = await prisma.tag.findMany({
    include: { _count: { select: { leads: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(tags);
}

export async function POST(req: Request) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const schema = z.object({ name: z.string().min(1), color: z.string().default("#9E8C61") });
  try {
    const data = schema.parse(await req.json());
    const tag = await prisma.tag.create({ data });
    return NextResponse.json(tag, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
