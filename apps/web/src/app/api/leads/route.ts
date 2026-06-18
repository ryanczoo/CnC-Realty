import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { sendLeadNotification } from "@/lib/email";
import { publicFormRateLimit } from "@/lib/rate-limit";
import { applyTag } from "@/lib/tags";
import { buildLeadWhere, FilterCondition } from "@/lib/smart-list-filters";

const createSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  notes: z.string().optional(),
  source: z.enum(["WEBSITE", "REFERRAL", "SOCIAL", "OPEN_HOUSE", "COLD_CALL", "OTHER"]).default("WEBSITE"),
});

// Public — no auth required.
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
    sendLeadNotification(lead).catch(console.error);
    if (data.source === "OPEN_HOUSE") {
      applyTag(lead.id, "Open House").catch(console.error);
    }
    return NextResponse.json({ id: lead.id }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Agents see their own leads; ADMIN sees all.
export async function GET(req: Request) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { id: userId, role } = session.user;
  const url = new URL(req.url);
  const filtersParam = url.searchParams.get("filters");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "25")));

  if (!filtersParam) {
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

  let filters: FilterCondition[] = [];
  try {
    filters = JSON.parse(filtersParam);
    if (!Array.isArray(filters)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid filters" }, { status: 400 });
  }

  let agentId: string | null = null;
  if (role !== "ADMIN") {
    const agent = await prisma.agent.findUnique({ where: { userId } });
    if (!agent) return NextResponse.json({ leads: [], total: 0, page, pageSize });
    agentId = agent.id;
  }

  const where = buildLeadWhere(filters, agentId);

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        source: true,
        priceMin: true,
        priceMax: true,
        lastContactedAt: true,
        tags: { select: { tag: { select: { name: true, color: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({ leads, total, page, pageSize });
}
