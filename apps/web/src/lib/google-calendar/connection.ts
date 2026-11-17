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

/** Marks the connection broken; firstTime is true only the first time (alert once). */
export async function markBroken(): Promise<{ firstTime: boolean }> {
  const conn = await getConnection();
  if (!conn) return { firstTime: false };
  const firstTime = conn.alertSentAt === null;
  await write({
    ...conn,
    status: "broken",
    alertSentAt: conn.alertSentAt ?? new Date().toISOString(),
  });
  return { firstTime };
}

export async function deleteConnection(): Promise<void> {
  await prisma.siteSettings.deleteMany({ where: { key: KEY } });
}
