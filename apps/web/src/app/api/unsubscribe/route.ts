import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";

// POST, not GET. Mail scanners and link-preview bots fetch URLs they find in
// email; a mutating GET would opt out people who never clicked.
export async function POST(req: Request) {
  // Two callers with different body formats. RFC 8058 one-click has the mail
  // client POST `List-Unsubscribe=One-Click` as form data with the token in the
  // query string; our own confirmation page POSTs JSON. Reading the query first
  // means the form-encoded body is never parsed as JSON.
  let token = new URL(req.url).searchParams.get("t") ?? "";

  if (!token) {
    try {
      token = (await req.json())?.token ?? "";
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
  }

  const claim = verifyUnsubscribeToken(token);
  if (!claim) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  if (claim.kind === "lead") {
    await prisma.lead.update({
      where: { id: claim.id },
      data: { emailOptOut: true },
    });
  } else {
    await prisma.user.update({
      where: { id: claim.id },
      data: { emailOptOut: true },
    });
  }

  return NextResponse.json({ ok: true });
}
