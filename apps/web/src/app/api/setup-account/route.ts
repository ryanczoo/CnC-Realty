import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  token:    z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, password } = schema.parse(body);

    const user = await prisma.user.findUnique({ where: { setupToken: token } });
    if (!user || !user.setupTokenExpiry || user.setupTokenExpiry < new Date()) {
      return NextResponse.json({ error: "This link has expired or is invalid. Please contact info@cncrealtygroup.com." }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, setupToken: null, setupTokenExpiry: null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("[POST /api/setup-account]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
