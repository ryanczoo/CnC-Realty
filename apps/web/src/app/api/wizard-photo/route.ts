import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import sharp from "sharp";
import { authOptions } from "@/lib/auth";
import { deleteR2Object, getR2ObjectBuffer, uploadToR2 } from "@/lib/r2";
import { wizardPhotoPrefix } from "@/lib/wizard-photo";

export const dynamic = "force-dynamic";

// Longest side, like the headshot route's MAX_DIMENSION — big enough for the
// full-size view, small enough that the file page stays fast.
const MAX_DIMENSION = 1600;

// Step 2 of a wizard photo upload: shrink the raw photo the browser just put in
// R2, store it as photo.jpg next to it, delete the original.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key } = await req.json().catch(() => ({}));
  if (typeof key !== "string" || !key.startsWith(wizardPhotoPrefix(session.user.id)) || !key.endsWith("/original") || key.includes("..")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let buffer: Buffer;
  try {
    buffer = await sharp(await getR2ObjectBuffer(key))
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "Couldn't read that photo" }, { status: 400 });
  }

  const photoKey = key.replace(/\/original$/, "/photo.jpg");
  try {
    await uploadToR2(photoKey, buffer, "image/jpeg");
    await deleteR2Object(key);
    return NextResponse.json({ photoKey });
  } catch (err) {
    console.error("[wizard-photo]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
