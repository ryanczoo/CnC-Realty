import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicFormRateLimit } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/form-validation";
import { emailMatchWhere } from "@/lib/email-match";
import { sendSafely } from "@/lib/email/send-safely";
import { sendNewsletterWelcome } from "@/lib/email/newsletter-email";

// Footer newsletter signup (single opt-in). A new address becomes a brokerage
// lead (no agent); an address that's already a lead is subscribed in place, so
// it stays with its agent and no duplicate is made. The welcome email goes out
// only the first time someone joins. Always answers { ok: true } for a valid
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

  const now = new Date();
  const existing = await prisma.lead.findFirst({
    where: emailMatchWhere(email),
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, newsletterSubscribedAt: true },
  });

  if (existing) {
    const firstJoin = !existing.newsletterSubscribedAt;
    await prisma.lead.update({
      where: { id: existing.id },
      data: firstJoin ? { newsletterSubscribedAt: now, newsletterOptOut: false } : { newsletterOptOut: false },
    });
    if (firstJoin) await sendSafely(() => sendNewsletterWelcome({ to: existing.email, leadId: existing.id }));
    return NextResponse.json({ ok: true });
  }

  const lead = await prisma.lead.create({
    data: {
      firstName: "Newsletter", lastName: "Subscriber", email,
      source: "NEWSLETTER", agentId: null, newsletterSubscribedAt: now,
    },
  });
  await sendSafely(() => sendNewsletterWelcome({ to: email, leadId: lead.id }));
  return NextResponse.json({ ok: true });
}
