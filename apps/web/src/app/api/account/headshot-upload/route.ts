import { NextResponse } from "next/server";
import sharp from "sharp";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/r2";

export const dynamic = "force-dynamic";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;
const MAX_DIMENSION = 512;

export async function POST(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Only JPEG, PNG, or WebP allowed" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });

  const key = `headshots/${session.user.id}`;
  const rawBuffer = Buffer.from(await file.arrayBuffer());
  const buffer = await sharp(rawBuffer)
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  try {
    await uploadToR2(key, buffer, "image/jpeg");
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
