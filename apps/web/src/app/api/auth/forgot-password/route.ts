import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPasswordReset } from "@/lib/email";

const schema = z.object({
  email: z.string().email(),
});

const RESET_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = schema.parse(body);

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const resetToken = randomBytes(32).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry },
      });

      const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`;
      await sendPasswordReset(user.email!, resetUrl);
    }

    // Always return the same response whether or not the account exists,
    // so this endpoint can't be used to enumerate registered emails.
    return NextResponse.json({ ok: true });
  } catch {
    // Same reasoning: don't leak validation details either.
    return NextResponse.json({ ok: true });
  }
}
