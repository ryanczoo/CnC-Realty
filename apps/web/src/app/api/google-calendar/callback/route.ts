import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { redis } from "@/lib/redis";
import { BOOKING_CALENDAR_EMAIL } from "@/lib/booking/rules";
import { saveConnection } from "@/lib/google-calendar/connection";
import { exchangeCode } from "@/lib/google-calendar/oauth";
import { MissingScopeError } from "@/lib/google-calendar/errors";

function sameState(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function done(result: string): NextResponse {
  const res = NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/settings?gcal=${result}`);
  res.cookies.set("gcal_state", "", { path: "/api/google-calendar", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state");
  const cookie = req.cookies.get("gcal_state")?.value;
  if (!state || !cookie || !sameState(state, cookie)) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code || req.nextUrl.searchParams.get("error")) return done("error");

  let tokens;
  try {
    tokens = await exchangeCode(code);
  } catch (err) {
    return done(err instanceof MissingScopeError ? "missing-scope" : "error");
  }

  if (tokens.email.toLowerCase() !== BOOKING_CALENDAR_EMAIL.toLowerCase()) {
    return done("wrong-account");
  }

  await saveConnection(tokens.email, tokens.refreshToken);
  try {
    await redis.del("booking:busy:v1", "gcal:access-token");
  } catch {
    // A Redis failure must not fail the connect.
  }
  return done("connected");
}
