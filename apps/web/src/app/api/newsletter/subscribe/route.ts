import { NextResponse } from "next/server";
import { publicFormRateLimit } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/form-validation";
import { subscribeToNewsletter } from "@/lib/newsletter";

// Footer newsletter signup (single opt-in). The subscription rules live in the
// shared subscribeToNewsletter(). Always answers { ok: true } for a valid
// email, so the form can't be used to check who's already in the system.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anonymous";
  const { success, reset } = await publicFormRateLimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } }
    );
  }

  let email = "";
  try {
    email = String((await req.json())?.email ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  await subscribeToNewsletter({ email, source: "footer" });
  return NextResponse.json({ ok: true });
}
