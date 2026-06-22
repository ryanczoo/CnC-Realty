import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/r2";

export const dynamic = "force-dynamic";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Only JPEG, PNG, or WebP allowed" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });

  const key = `headshots/${session.user.id}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await uploadToR2(key, buffer, file.type);
    await prisma.agent.updateMany({
      where: { userId: session.user.id },
      data: { headshot: key },
    });
    return NextResponse.json({ key });
  } catch (err) {
    console.error("[headshot-upload]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
