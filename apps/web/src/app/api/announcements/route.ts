import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  body: z.string().min(1, "Body is required"),
});

export async function POST(req: Request) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  try {
    const json = await req.json();
    const { title, body } = schema.parse(json);

    const announcement = await prisma.announcement.create({
      data: { title, body },
    });

    return NextResponse.json(announcement);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("[POST /api/announcements]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
