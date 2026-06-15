import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { sendLeadNotification } from "@/lib/email";
import { publicFormRateLimit } from "@/lib/rate-limit";

const createSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  notes: z.string().optional(),
  source: z.enum(["WEBSITE", "REFERRAL", "SOCIAL", "OPEN_HOUSE", "COLD_CALL", "OTHER"]).default("WEBSITE"),
});

// Public — no auth required. Anyone can submit a lead.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anonymous";
  const { success, reset } = await publicFormRateLimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } }
    );
  }

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const lead = await prisma.lead.create({ data });

    // Fire-and-forget — don't fail the request if email fails
    sendLeadNotification(lead).catch(console.error);

    return NextResponse.json({ id: lead.id }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Agents see their own leads; ADMIN sees all leads.
export async function GET() {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { id: userId, role } = session.user;

  if (role === "ADMIN") {
    const leads = await prisma.lead.findMany({
      include: { agent: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json(leads);
  }

  const agent = await prisma.agent.findUnique({ where: { userId } });
  if (!agent) return NextResponse.json([]);

  const leads = await prisma.lead.findMany({
    where: { agentId: agent.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(leads);
}
