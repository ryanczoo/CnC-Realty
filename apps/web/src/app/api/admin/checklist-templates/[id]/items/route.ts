import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { builtBeforeError, parseBuiltBefore } from "@/lib/year-built";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, description, order, isRequired, builtBefore } = await req.json();
  if (!name || order === undefined) return NextResponse.json({ error: "name and order required" }, { status: 400 });
  const yearError = builtBeforeError(builtBefore);
  if (yearError) return NextResponse.json({ error: yearError }, { status: 400 });

  const item = await prisma.checklistTemplateItem.create({
    data: { templateId: params.id, name, description: description ?? null, order, isRequired: isRequired ?? true, builtBefore: parseBuiltBefore(builtBefore) },
  });

  return NextResponse.json({ item }, { status: 201 });
}
