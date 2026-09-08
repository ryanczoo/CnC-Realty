import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { publicFormRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  token:    z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  try {
    const { success, reset } = await publicFormRateLimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } }
      );
    }
  } catch (err) {
    console.error("[POST /api/reset-password] rate limiter unavailable, proceeding:", err);
  }

  try {
    const body = await req.json();
    const { token, password } = schema.parse(body);

    const user = await prisma.user.findUnique({ where: { resetToken: token } });
    if (!user || (user.resetTokenExpiry && user.resetTokenExpiry < new Date())) {
      return NextResponse.json({ error: "This link has expired or is invalid. Please request a new one." }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpiry: null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("[POST /api/reset-password]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
