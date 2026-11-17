import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyManageToken } from "@/lib/booking/tokens";
import { cancelBooking, getManageView, rescheduleBooking } from "@/lib/booking/manage-booking";
import { checkPublicRateLimit } from "@/lib/public-rate-limit";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({ t: z.string().min(1), action: z.literal("cancel") }),
  z.object({
    t: z.string().min(1),
    action: z.literal("reschedule"),
    startsAt: z.string().datetime({ offset: true, message: "Valid time required" }),
  }),
]);

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

export async function GET(req: Request) {
  const limited = await checkPublicRateLimit(req);
  if (limited) return limited;

  const id = verifyManageToken(new URL(req.url).searchParams.get("t") ?? "");
  if (!id) return notFound();
  try {
    const view = await getManageView(id);
    if (!view) return notFound();
    return NextResponse.json(view);
  } catch (err) {
    console.error("[GET /api/booking/manage]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

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

  const id = verifyManageToken(data.t);
  if (!id) return notFound();

  try {
    if (data.action === "cancel") {
      const ok = await cancelBooking(id);
      if (!ok) return notFound();
      return NextResponse.json({ status: "CANCELLED" });
    }
    const result = await rescheduleBooking(id, new Date(data.startsAt));
    if (result.ok) return NextResponse.json({ startsAt: result.startsAt.toISOString() });
    if (result.reason === "not_found") return notFound();
    if (result.reason === "unavailable") return NextResponse.json({ error: "unavailable" }, { status: 503 });
    return NextResponse.json({ error: result.reason }, { status: 409 });
  } catch (err) {
    console.error("[POST /api/booking/manage]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
