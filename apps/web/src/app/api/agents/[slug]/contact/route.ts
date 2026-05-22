import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const { name, email, phone, message } = await req.json();

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const agent = await prisma.agent.findUnique({ where: { slug: params.slug } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const parts = (name as string).trim().split(/\s+/);
  const firstName = parts[0] ?? "Unknown";
  const lastName = parts.slice(1).join(" ") || "—";

  await prisma.lead.create({
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

  return NextResponse.json({ ok: true });
}
