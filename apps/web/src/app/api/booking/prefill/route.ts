import { NextResponse } from "next/server";
import { verifyRecruitToken } from "@/lib/booking/tokens";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t");
  const recruit = t ? verifyRecruitToken(t) : null;
  if (!recruit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(recruit);
}
