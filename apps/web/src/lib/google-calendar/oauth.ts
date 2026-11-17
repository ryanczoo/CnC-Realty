import { BOOKING_CALENDAR_EMAIL } from "@/lib/booking/rules";
import { GoogleAuthError, MissingScopeError } from "./errors";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
].join(" ");

export function redirectUri(): string {
  return `${process.env.NEXTAUTH_URL}/api/google-calendar/callback`;
}

export function clientCreds(): { client_id: string; client_secret: string } {
  return {
    client_id: process.env.GOOGLE_CAL_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CAL_CLIENT_SECRET ?? "",
  };
}

export function authUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientCreds().client_id,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    login_hint: BOOKING_CALENDAR_EMAIL,
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<{ refreshToken: string; email: string }> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...clientCreds(),
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  const tok = (await res.json()) as { access_token?: string; refresh_token?: string; scope?: string };
  if (!tok.access_token || !tok.refresh_token) throw new Error("Google did not return a refresh token");
  // Granular consent lets the user untick the Calendar boxes; the token would then 403 on every call.
  const granted = (tok.scope ?? "").split(" ");
  const required = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.freebusy",
  ];
  if (!required.every((s) => granted.includes(s))) throw new MissingScopeError();

  const info = await fetch(USERINFO_ENDPOINT, { headers: { Authorization: `Bearer ${tok.access_token}` } });
  if (!info.ok) throw new Error(`Google userinfo failed (${info.status})`);
  const { email, email_verified } = (await info.json()) as { email?: string; email_verified?: boolean };
  if (!email) throw new Error("Google did not return an email");
  if (email_verified !== true) throw new Error("Google email is not verified");
  return { refreshToken: tok.refresh_token, email };
}

/** Refresh grant. Throws GoogleAuthError on invalid_grant. */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...clientCreds(), refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (body.error === "invalid_grant" || res.status === 401) throw new GoogleAuthError("Refresh token rejected");
    throw new Error(`Google token refresh failed (${res.status})`);
  }
  const tok = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: tok.access_token, expiresIn: tok.expires_in };
}
