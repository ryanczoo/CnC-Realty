import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createId } from "@paralleldrive/cuid2";
import { authOptions } from "@/lib/auth";
import { getPresignedPutUrl } from "@/lib/r2";
import { PHOTO_MAX_BYTES, PHOTO_TYPES, wizardPhotoPrefix } from "@/lib/wizard-photo";

// Step 1 of a wizard photo upload: a presigned URL for the raw photo, which the
// browser PUTs straight to R2 (Vercel caps function request bodies at ~4.5MB,
// smaller than a phone photo). Step 2 (POST /api/wizard-photo) shrinks it.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const contentType = searchParams.get("contentType") ?? "";
  const size = Number(searchParams.get("size") ?? 0);
  if (!PHOTO_TYPES.includes(contentType)) {
    return NextResponse.json({ error: "Photo must be a JPG or PNG" }, { status: 400 });
  }
  if (!(size > 0)) {
    return NextResponse.json({ error: "Photo size is required" }, { status: 400 });
  }
  if (size > PHOTO_MAX_BYTES) {
    return NextResponse.json({ error: "Photo exceeds 20MB limit" }, { status: 400 });
  }

  const key = `${wizardPhotoPrefix(session.user.id)}${createId()}/original`;
  // The stated size is signed in, so storage refuses a bigger body than claimed.
  const uploadUrl = await getPresignedPutUrl(key, contentType, size);
  return NextResponse.json({ uploadUrl, key });
}
