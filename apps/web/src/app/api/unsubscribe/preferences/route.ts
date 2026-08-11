import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyUnsubscribeToken,
  CATEGORY_KIND,
  type EmailCategory,
} from "@/lib/email/unsubscribe";

// Values are "is subscribed", not "is opted out". The UI shows checkboxes the
// recipient ticks to keep receiving something, so the API speaks the same way
// and the inversion happens in exactly one place.
type Preferences = Partial<Record<EmailCategory, boolean>>;

// Derived rather than hand-maintained: a category added to CATEGORY_KIND lands
// in the right list automatically, so it cannot be forgotten here.
const ALL_CATEGORIES = Object.keys(CATEGORY_KIND) as EmailCategory[];
const LEAD_CATEGORIES = ALL_CATEGORIES.filter((c) => CATEGORY_KIND[c] === "lead");
const USER_CATEGORIES = ALL_CATEGORIES.filter((c) => CATEGORY_KIND[c] === "user");

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const claim = verifyUnsubscribeToken(token);
  if (!claim) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  if (claim.kind === "lead") {
    const row = await prisma.lead.findUnique({
      where: { id: claim.id },
      select: { campaignOptOut: true, actionPlanOptOut: true },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      kind: claim.kind,
      category: claim.category,
      preferences: {
        campaign: !row.campaignOptOut,
        action_plan: !row.actionPlanOptOut,
      },
    });
  }

  const row = await prisma.user.findUnique({
    where: { id: claim.id },
    select: { propertyAlertOptOut: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    kind: claim.kind,
    category: claim.category,
    preferences: { property_alert: !row.propertyAlertOptOut },
  });
}

export async function POST(req: Request) {
  let body: { token?: string; preferences?: Preferences };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const claim = verifyUnsubscribeToken(body.token ?? "");
  if (!claim) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  const prefs = body.preferences ?? {};

  // Only categories this recipient's table can actually receive. A lead has no
  // property alerts to manage, so a stray key is dropped rather than trusted.
  const allowed = claim.kind === "lead" ? LEAD_CATEGORIES : USER_CATEGORIES;
  const column: Record<EmailCategory, string> = {
    campaign: "campaignOptOut",
    action_plan: "actionPlanOptOut",
    property_alert: "propertyAlertOptOut",
  };

  const data: Record<string, boolean> = {};
  for (const category of allowed) {
    const subscribed = prefs[category];
    if (typeof subscribed === "boolean") data[column[category]] = !subscribed;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true });
  }

  if (claim.kind === "lead") {
    await prisma.lead.update({ where: { id: claim.id }, data });
  } else {
    await prisma.user.update({ where: { id: claim.id }, data });
  }

  return NextResponse.json({ ok: true });
}
