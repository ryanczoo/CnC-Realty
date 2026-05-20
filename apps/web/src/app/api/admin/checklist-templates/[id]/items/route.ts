import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, description, order, isRequired } = await req.json();
  if (!name || order === undefined) return NextResponse.json({ error: "name and order required" }, { status: 400 });

  const item = await prisma.checklistTemplateItem.create({
    data: { templateId: params.id, name, description: description ?? null, order, isRequired: isRequired ?? true },
  });

  return NextResponse.json({ item }, { status: 201 });
}
