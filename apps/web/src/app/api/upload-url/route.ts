import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPresignedPutUrl, buildR2Key } from "@/lib/r2";
import { createId } from "@paralleldrive/cuid2";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE = 50 * 1024 * 1024;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fileType = searchParams.get("fileType") as "listing" | "transaction" | null;
  const fileId = searchParams.get("fileId");
  const filename = searchParams.get("filename");
  const contentType = searchParams.get("contentType");
  const size = Number(searchParams.get("size") ?? 0);

  if (!fileType || !fileId || !filename || !contentType) {
    return NextResponse.json({ error: "fileType, fileId, filename, and contentType are required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json({ error: "File type not allowed. Use PDF, JPG, PNG, or DOCX." }, { status: 400 });
  }
  if (size > MAX_SIZE) {
    return NextResponse.json({ error: "File exceeds 50MB limit" }, { status: 400 });
  }

  const documentId = createId();
  const key = buildR2Key(fileType, fileId, documentId, filename);
  const uploadUrl = await getPresignedPutUrl(key, contentType);

  return NextResponse.json({ uploadUrl, key, documentId });
}
