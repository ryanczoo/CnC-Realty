// IndexNow verifies ownership by fetching this file and comparing it to the
// key sent with each ping. Read per request (never baked in at build) so the
// key can be set or rotated in the environment without a rebuild.
export const dynamic = "force-dynamic";

export function GET() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return new Response("Not found", { status: 404 });
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
