import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getPresignedPutUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function GET(req: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const contentType = searchParams.get("contentType") ?? "";

  if (!ALLOWED.includes(contentType)) {
    return NextResponse.json({ error: "Only JPEG, PNG, and WebP allowed" }, { status: 400 });
  }

  const key = `headshots/${session.user.id}`;
  const uploadUrl = await getPresignedPutUrl(key, contentType);
  return NextResponse.json({ uploadUrl, key });
}
