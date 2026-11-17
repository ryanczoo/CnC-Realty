import { prisma } from "@/lib/prisma";
import { sealSecret, openSecret } from "@/lib/secret-box";

const KEY = "google_calendar";

export type CalendarConnection = {
  status: "connected" | "broken";
  email: string;
  refreshToken: string;
  connectedAt: string;
  alertSentAt: string | null;
};

async function write(conn: CalendarConnection): Promise<void> {
  const value = sealSecret(JSON.stringify(conn));
  await prisma.siteSettings.upsert({
    where: { key: KEY },
    update: { value },
    create: { key: KEY, value },
  });
}

export async function getConnection(): Promise<CalendarConnection | null> {
  const row = await prisma.siteSettings.findUnique({ where: { key: KEY } });
  if (!row) return null;
  return JSON.parse(openSecret(row.value)) as CalendarConnection;
}

export async function saveConnection(email: string, refreshToken: string): Promise<void> {
  await write({
    status: "connected",
    email,
    refreshToken,
    connectedAt: new Date().toISOString(),
    alertSentAt: null,
  });
}

/**
 * Marks the connection broken; firstTime is true only for the caller that wins the write
 * (alert once). Compare-and-swap on the stored value so concurrent callers or a concurrent
 * saveConnection can't be clobbered by a stale read.
 */
export async function markBroken(): Promise<{ firstTime: boolean }> {
  const row = await prisma.siteSettings.findUnique({ where: { key: KEY } });
  if (!row) return { firstTime: false };
  const conn = JSON.parse(openSecret(row.value)) as CalendarConnection;
  if (conn.status === "broken" && conn.alertSentAt) return { firstTime: false };
  const next: CalendarConnection = {
    ...conn,
    status: "broken",
    alertSentAt: conn.alertSentAt ?? new Date().toISOString(),
  };
  const { count } = await prisma.siteSettings.updateMany({
    where: { key: KEY, value: row.value },
    data: { value: sealSecret(JSON.stringify(next)) },
  });
  return { firstTime: count === 1 };
}

export async function deleteConnection(): Promise<void> {
  await prisma.siteSettings.deleteMany({ where: { key: KEY } });
}
