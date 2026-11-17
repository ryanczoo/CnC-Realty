import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAuth } from "@/lib/api-auth";
import { authUrl } from "@/lib/google-calendar/oauth";

export async function GET() {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const state = randomBytes(32).toString("hex");
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set("gcal_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/google-calendar",
    maxAge: 600,
  });
  return res;
}
