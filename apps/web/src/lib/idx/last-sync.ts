import { prisma } from "@/lib/prisma";

// When the IDX feed was last fully pulled — what the CRMLS "Last updated" line
// shows. A listing's own syncedAt is only set when it is first inserted, so it
// can't stand in for this.
const SETTINGS_KEY = "idx_last_sync_at";

export async function recordIdxSync(at: Date): Promise<void> {
  const value = at.toISOString();
  await prisma.siteSettings.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value },
    update: { value },
  });
}

export async function getIdxLastSyncAt(): Promise<string | null> {
  const row = await prisma.siteSettings.findUnique({ where: { key: SETTINGS_KEY } });
  return row?.value ?? null;
}
