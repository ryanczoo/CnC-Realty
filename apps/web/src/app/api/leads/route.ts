import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { leadCreateData, afterLeadCreated } from "@/lib/leads/create-lead";
import { checkPublicRateLimit } from "@/lib/public-rate-limit";
import { applyTag } from "@/lib/tags";
import { buildLeadWhere, hasNewsletterFilter, FilterCondition } from "@/lib/smart-list-filters";

const createSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  notes: z.string().optional(),
  source: z.enum(["WEBSITE", "REFERRAL", "SOCIAL", "OPEN_HOUSE", "COLD_CALL", "OTHER"]).default("WEBSITE"),
  utmSource: z.string().optional(),
  role: z.string().optional(),
  newsletterConsent: z.boolean().optional(),
});

// Public — no auth required. Authenticated users skip rate limiting.
export async function POST(req: Request) {
  const limited = await checkPublicRateLimit(req);
  if (limited) return limited;

  try {
    const body = await req.json();
    const data = createSchema.parse(body);
    const { newsletterConsent, ...leadInput } = data;
    const lead = await prisma.lead.create({ data: leadCreateData(leadInput) });
    if (data.source === "OPEN_HOUSE") {
      applyTag(lead.id, "Open House").catch(console.error);
    }
    // Notification + consented newsletter enrollment (only the /contact page and
    // the shared contact pop-up send newsletterConsent) live in the shared core.
    await afterLeadCreated(lead, { newsletterConsent });
    return NextResponse.json({ id: lead.id }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Personal for everyone, admins included (Leads smart lists and the lead pickers).
export async function GET(req: Request) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { role, agentId: sessionAgentId } = session.user;
  const url = new URL(req.url);
  const filtersParam = url.searchParams.get("filters");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "25")));

  if (!filtersParam) {
    if (!sessionAgentId) return NextResponse.json([]);
    const leads = await prisma.lead.findMany({
      where: { agentId: sessionAgentId },
      orderBy: { createdAt: "desc" },
      take: 200,
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

  // The newsletter list is admin-only and brokerage-wide (only admins run the
  // newsletter); every other list is personal.
  const isNewsletterList = hasNewsletterFilter(filters);
  if (isNewsletterList && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isNewsletterList && !sessionAgentId) {
    return NextResponse.json({ leads: [], total: 0, page, pageSize });
  }
  const agentId: string | null = isNewsletterList ? null : sessionAgentId;

  const where = buildLeadWhere(filters, agentId);

  try {
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
  } catch (e) {
    console.error("[GET /api/leads] filter query failed:", e);
    return NextResponse.json({ leads: [], total: 0, page, pageSize }, { status: 200 });
  }
}
