// Shared by every cron route triggered by Vercel Cron with a bearer-token
// secret. Mirrors the pattern api/idx/sync/route.ts already used correctly:
// an unset secret must fail closed, not silently accept the literal string
// "Bearer undefined" as a valid credential.
export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
