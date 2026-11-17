import { redis } from "@/lib/redis";
import { NOTIFY, emailLayout, buildHeadingBodyHtml } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";
import { sendSafely } from "@/lib/email/send-safely";
import type { Interval } from "@/lib/booking/slots";
import { getConnection, markBroken } from "./connection";
import { refreshAccessToken } from "./oauth";
import { GoogleAuthError } from "./errors";

const CAL = "https://www.googleapis.com/calendar/v3";
const TOKEN_KEY = "gcal:access-token";

export async function getAccessToken(): Promise<string> {
  try {
    const cached = await redis.get<string>(TOKEN_KEY);
    if (cached) return cached;
  } catch {
    // Redis down: fall through to a fresh refresh.
  }
  let conn;
  try {
    conn = await getConnection();
  } catch {
    throw new GoogleAuthError("Stored Google connection is unreadable");
  }
  if (!conn || conn.status !== "connected") throw new GoogleAuthError("Google Calendar is not connected");
  const { accessToken, expiresIn } = await refreshAccessToken(conn.refreshToken);
  try {
    await redis.set(TOKEN_KEY, accessToken, { ex: Math.max(expiresIn - 60, 1) });
  } catch {
    // Cache is best effort.
  }
  return accessToken;
}

const QUOTA_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded", "dailyLimitExceeded"]);
const AUTH_REASONS = new Set(["insufficientPermissions", "accessNotConfigured", "forbidden"]);

/** True when a 403 means our grant is bad (not a transient quota/rate limit). */
async function isAuthForbidden(res: Response): Promise<boolean> {
  try {
    const body = (await res.clone().json()) as { error?: { errors?: { reason?: string }[]; status?: string } };
    const reasons = (body.error?.errors ?? []).map((e) => e.reason ?? "");
    if (reasons.some((r) => QUOTA_REASONS.has(r))) return false;
    return reasons.some((r) => AUTH_REASONS.has(r));
  } catch {
    return false;
  }
}

async function gfetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(`${CAL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (res.status === 401) {
    try {
      await redis.del(TOKEN_KEY);
    } catch {
      // ignore
    }
    throw new GoogleAuthError("Google returned 401");
  }
  if (res.status === 403 && (await isAuthForbidden(res))) {
    throw new GoogleAuthError("Google returned 403 (insufficient permissions)");
  }
  return res;
}

function assertOk(res: Response, what: string): void {
  if (!res.ok) throw new Error(`Google Calendar ${what} failed (${res.status})`);
}

export async function freeBusy(from: Date, to: Date): Promise<Interval[]> {
  const res = await gfetch("/freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: "primary" }] }),
  });
  assertOk(res, "freeBusy");
  const data = (await res.json()) as {
    calendars?: { primary?: { errors?: unknown[]; busy?: { start: string; end: string }[] } };
  };
  if (!data.calendars?.primary) throw new Error("Google Calendar freeBusy response missing primary calendar");
  if ((data.calendars.primary.errors?.length ?? 0) > 0) {
    throw new Error("Google Calendar freeBusy reported errors for the primary calendar");
  }
  return (data.calendars?.primary?.busy ?? []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

export type NewEvent = {
  bookingId: string;
  start: Date;
  end: Date;
  summary: string;
  description: string;
  attendeeEmail: string;
  meet: boolean;
  location?: string;
};

export async function createEvent(e: NewEvent): Promise<{ id: string; meetLink: string | null }> {
  const body: Record<string, unknown> = {
    summary: e.summary,
    description: e.description,
    start: { dateTime: e.start.toISOString() },
    end: { dateTime: e.end.toISOString() },
    attendees: [{ email: e.attendeeEmail }],
  };
  if (e.location) body.location = e.location;
  if (e.meet) {
    body.conferenceData = {
      createRequest: { requestId: e.bookingId, conferenceSolutionKey: { type: "hangoutsMeet" } },
    };
  }
  const res = await gfetch("/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all", {
    method: "POST",
    body: JSON.stringify(body),
  });
  assertOk(res, "createEvent");
  const data = (await res.json()) as {
    id: string;
    hangoutLink?: string;
    conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  };
  const video = data.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri;
  return { id: data.id, meetLink: data.hangoutLink ?? video ?? null };
}

export async function moveEvent(id: string, start: Date, end: Date): Promise<void> {
  const res = await gfetch(`/calendars/primary/events/${encodeURIComponent(id)}?sendUpdates=all`, {
    method: "PATCH",
    body: JSON.stringify({ start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } }),
  });
  assertOk(res, "moveEvent");
}

export async function deleteEvent(id: string): Promise<void> {
  const res = await gfetch(`/calendars/primary/events/${encodeURIComponent(id)}?sendUpdates=all`, {
    method: "DELETE",
  });
  if (res.status === 404 || res.status === 410) return;
  assertOk(res, "deleteEvent");
}

export async function eventExists(id: string): Promise<boolean> {
  const res = await gfetch(`/calendars/primary/events/${encodeURIComponent(id)}`);
  if (res.status === 404 || res.status === 410) return false;
  assertOk(res, "eventExists");
  const data = (await res.json()) as { status?: string };
  return data.status !== "cancelled";
}

/** On a Google auth failure, marks the connection broken (alerting Ryan once) and rethrows. */
export async function withGoogle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      try {
        const { firstTime } = await markBroken();
        if (firstTime) {
          const settingsUrl = `${process.env.NEXTAUTH_URL}/dashboard/settings`;
          await sendSafely(() =>
            sendEmail({
              to: NOTIFY,
              subject: "Booking calendar disconnected — reconnect in Settings",
              html: emailLayout({
                bodyHtml: buildHeadingBodyHtml({
                  heading: "Booking calendar disconnected",
                  bodyHtml:
                    "<p>Google Calendar stopped accepting our connection, so bookings are paused until you reconnect in Dashboard → Settings.</p>",
                }),
                ctaLabel: "Open Settings",
                ctaHref: settingsUrl,
              }),
              stream: "transactional",
            })
          );
        }
      } catch {
        // Never mask the original auth error.
      }
    }
    throw err;
  }
}
