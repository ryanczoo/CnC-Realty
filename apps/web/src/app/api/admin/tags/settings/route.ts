import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const schema = z.object({ key: z.string(), value: z.string() });

export async function POST(req: Request) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;
  try {
    const { key, value } = schema.parse(await req.json());
    await prisma.siteSettings.upsert({ where: { key }, update: { value }, create: { key, value } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
