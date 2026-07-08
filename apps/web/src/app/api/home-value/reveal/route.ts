import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { computeEstimate, findComps } from "@/lib/home-value-estimate";
import { publicFormRateLimit } from "@/lib/rate-limit";
import { sendLeadNotification } from "@/lib/email";

const revealSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(1, "Phone required"),
  address: z.string().min(1),
  zip: z.string().min(1),
  beds: z.number().nullable(),
  sqft: z.number(),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anonymous";
  try {
    const { success, reset } = await publicFormRateLimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } }
      );
    }
  } catch (err) {
    console.error("[home-value/reveal] rate limiter unavailable, proceeding:", err);
  }

  try {
    const body = await req.json();
    const data = revealSchema.parse(body);

    const comps = await findComps(prisma, { zip: data.zip, beds: data.beds });
    const estimate = computeEstimate(
      comps.map((c) => ({ closePrice: c.closePrice, sqft: c.sqft ?? 0 })),
      data.sqft
    );

    if (!estimate) {
      return NextResponse.json({ error: "Not enough local data to compute an estimate" }, { status: 422 });
    }

    const lead = await prisma.lead.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        source: "HOME_VALUATION",
        notes: `Home value request for ${data.address}, ${data.zip}. Estimated at $${estimate.pointEstimate.toLocaleString()}.`,
      },
    });
    sendLeadNotification(lead).catch(console.error);

    return NextResponse.json({ pointEstimate: estimate.pointEstimate }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("[home-value/reveal] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
