import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { redis } from "@/lib/redis";
import { getConnection, deleteConnection } from "@/lib/google-calendar/connection";

export async function GET() {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  try {
    const conn = await getConnection();
    if (!conn) return NextResponse.json({ status: "disconnected" });
    return NextResponse.json({ status: conn.status, email: conn.email });
  } catch {
    // Unreadable stored blob (e.g. rotated key): report broken, never 500.
    return NextResponse.json({ status: "broken" });
  }
}

export async function DELETE() {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  try {
    const conn = await getConnection();
    if (conn) {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: conn.refreshToken }),
      }).catch(() => undefined);
    }
  } catch {
    // Best effort revoke; still delete the row below.
  }
  await deleteConnection();
  try {
    await redis.del("gcal:access-token", "booking:busy:v1");
  } catch {
    // ignore
  }
  return NextResponse.json({ status: "disconnected" });
}
