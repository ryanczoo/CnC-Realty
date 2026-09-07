import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { publicFormRateLimit } from "@/lib/rate-limit";

const registerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password too long"),
});

export async function POST(req: NextRequest) {
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
    console.error("[auth/register] rate limiter unavailable, proceeding:", err);
  }

  let body: z.infer<typeof registerSchema>;
  try {
    const json = await req.json();
    body = registerSchema.parse(json);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, email, password } = body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use." }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: { name, email, password: hashed },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
