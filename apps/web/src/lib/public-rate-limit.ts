import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { publicFormRateLimit } from "@/lib/rate-limit";

/** Public-form rate limit. Returns a 429 response to send back, or null to proceed. Logged-in users skip it. */
export async function checkPublicRateLimit(req: Request): Promise<NextResponse | null> {
  const { session } = await requireAuth("AGENT");
  if (session) return null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anonymous";
  try {
    const { success, reset } = await publicFormRateLimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } }
      );
    }
  } catch (err) {
    console.error("[public rate limit] limiter unavailable, proceeding:", err);
  }
  return null;
}
