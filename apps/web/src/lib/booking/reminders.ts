const MIN = 60_000;
const HOUR = 60 * MIN;

export type ReminderKind = "24h" | "1h";

export function reminderDue(
  b: { startsAt: Date; scheduledAt: Date; reminder24SentAt: Date | null; reminder1SentAt: Date | null },
  now: Date
): ReminderKind | null {
  const until = b.startsAt.getTime() - now.getTime();
  const bookedAt = b.scheduledAt.getTime();
  const start = b.startsAt.getTime();

  if (until > 0 && until <= HOUR && !b.reminder1SentAt && bookedAt <= start - HOUR) return "1h";
  if (until > HOUR && until <= 24 * HOUR && !b.reminder24SentAt && bookedAt <= start - 24 * HOUR) return "24h";
  return null;
}
