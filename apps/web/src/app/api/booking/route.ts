import { NextResponse } from "next/server";
import { z } from "zod";
import { createBooking } from "@/lib/booking/create-booking";
import { verifyRecruitToken } from "@/lib/booking/tokens";
import { checkPublicRateLimit } from "@/lib/public-rate-limit";
import { ROLE_OPTIONS } from "@/lib/role-options";

export const dynamic = "force-dynamic";

const schema = z.object({
  startsAt: z.string().datetime({ offset: true, message: "Valid time required" }),
  // Caps keep oversized text out of the Google event, the invite and the emails.
  firstName: z.string().trim().min(1, "First name required").max(100, "First name is too long"),
  lastName: z.string().trim().min(1, "Last name required").max(100, "Last name is too long"),
  email: z.string().max(254, "Email is too long").email("Valid email required"),
  phone: z.string().max(40, "Phone number is too long").refine((v) => v.replace(/\D/g, "").length >= 7, "Valid phone number required"),
  role: z.string().refine((v) => ROLE_OPTIONS.includes(v), "Please choose an option"),
  notes: z.string().max(2000, "Message is too long (2,000 characters max)").optional(),
  meetingType: z.enum(["PHONE", "MEET"]),
  page: z.enum(["CONTACT", "JOIN"]),
  recruitToken: z.string().optional(),
});

export async function POST(req: Request) {
  const limited = await checkPublicRateLimit(req);
  if (limited) return limited;

  let data: z.infer<typeof schema>;
  try {
    data = schema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const bookingSource =
      data.recruitToken && verifyRecruitToken(data.recruitToken) ? "RECRUITING_EMAIL" : data.page;
    const result = await createBooking({
      startsAt: new Date(data.startsAt),
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      role: data.role,
      notes: data.notes || undefined,
      meetingType: data.meetingType,
      bookingSource,
      source: "WEBSITE",
      utmSource: `BOOKING_${bookingSource}`,
      newsletterConsent: true,
    });
    if (!result.ok) {
      const status = result.reason === "taken" ? 409 : 503;
      return NextResponse.json({ error: result.reason }, { status });
    }
    const { booking } = result;
    return NextResponse.json(
      {
        startsAt: booking.startsAt.toISOString(),
        meetingType: booking.meetingType,
        meetLink: booking.meetLink ?? null,
        manageUrl: result.manageUrl,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/booking]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
