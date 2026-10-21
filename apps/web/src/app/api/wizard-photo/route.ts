import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import sharp from "sharp";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Object, getR2ObjectBuffer, getR2ObjectSize, uploadToR2 } from "@/lib/r2";
import { PHOTO_MAX_BYTES, isOwnWizardPhoto, wizardPhotoPrefix } from "@/lib/wizard-photo";

export const dynamic = "force-dynamic";

// Longest side, like the headshot route's MAX_DIMENSION — big enough for the
// full-size view, small enough that the file page stays fast.
const MAX_DIMENSION = 1600;

// Best-effort cleanup: a failed delete is logged, never shown as a failed upload.
const tidy = (key: string) => deleteR2Object(key).catch((err) => console.error("[wizard-photo] cleanup", key, err));

// Step 2 of a wizard photo upload: shrink the raw photo the browser just put in
// R2, store it as photo.jpg next to it, delete the original. `replaces` is the
// photo this one replaces ("Replace Photo"): deleted when it is the caller's own
// and no file uses it yet.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key, replaces } = await req.json().catch(() => ({}));
  if (typeof key !== "string" || !key.startsWith(wizardPhotoPrefix(session.user.id)) || !key.endsWith("/original") || key.includes("..")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // The real stored size, not the browser's claim, before reading it into memory.
  if ((await getR2ObjectSize(key)) > PHOTO_MAX_BYTES) {
    await tidy(key);
    return NextResponse.json({ error: "Photo exceeds 20MB limit" }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = await sharp(await getR2ObjectBuffer(key))
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" }) // JPEG has no transparency: white, not black
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    await tidy(key);
    return NextResponse.json({ error: "Couldn't read that photo" }, { status: 400 });
  }

  const photoKey = key.replace(/\/original$/, "/photo.jpg");
  try {
    await uploadToR2(photoKey, buffer, "image/jpeg");
  } catch (err) {
    console.error("[wizard-photo]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
  await tidy(key);

  if (typeof replaces === "string" && replaces !== photoKey && isOwnWizardPhoto(replaces, session.user.id)) {
    const [listings, transactions] = await Promise.all([
      prisma.listingFile.count({ where: { photoKey: replaces } }),
      prisma.transactionFile.count({ where: { photoKey: replaces } }),
    ]);
    if (listings + transactions === 0) await tidy(replaces);
  }

  return NextResponse.json({ photoKey });
}
