import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { sendLeadNotification } from "@/lib/email";
import { publicFormRateLimit } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/form-validation";
import { subscribeToNewsletter } from "@/lib/newsletter";

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anonymous";
  const { success, reset } = await publicFormRateLimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } }
    );
  }

  try {
    const { name, email, phone, message } = await req.json();

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }
    if (!isValidEmail((email as string).trim())) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const agent = await prisma.agent.findUnique({ where: { slug: params.slug } });
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const parts = (name as string).trim().split(/\s+/);
    const firstName = parts[0] ?? "Unknown";
    const lastName = parts.slice(1).join(" ") || "—";

    const lead = await prisma.lead.create({
      data: {
        firstName,
        lastName,
        email: (email as string).trim(),
        phone: (phone as string)?.trim() || null,
        notes: (message as string)?.trim() || null,
        agentId: agent.id,
        source: "WEBSITE",
      },
    });

    sendLeadNotification(lead).catch(console.error);

    // The agent-profile form shows the consent disclaimer. Subscribes this new
    // lead, so the visitor stays the agent's lead. Never fails the inquiry.
    await subscribeToNewsletter({ email: (email as string).trim(), leadId: lead.id, source: "contact-form" }).catch((err) =>
      Sentry.captureException(err)
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[agents/contact] POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
