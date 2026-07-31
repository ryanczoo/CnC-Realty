import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { sendAnnouncement } from "@/lib/email";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const announcement = await prisma.announcement.findUnique({ where: { id: params.id } });
  if (!announcement) {
    return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  }

  if (announcement.sentAt) {
    return NextResponse.json({ error: "Announcement already sent" }, { status: 400 });
  }

  const agents = await prisma.user.findMany({
    where: { role: "AGENT" },
    select: { email: true },
  });

  await sendAnnouncement(
    agents.map((a) => a.email),
    announcement.title,
    announcement.body
  );

  const updated = await prisma.announcement.update({
    where: { id: params.id },
    data: { sentAt: new Date() },
  });

  return NextResponse.json(updated);
}
