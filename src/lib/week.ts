export const DAY_MS = 86_400_000;
const MANILA_OFFSET = 8 * 3_600_000; // Asia/Manila is UTC+8 and has no daylight saving time.

export function dayStart(now = new Date()) {
  return new Date(Math.floor((now.getTime() + MANILA_OFFSET) / DAY_MS) * DAY_MS - MANILA_OFFSET);
}

/** Weeks run Monday 00:00 through Sunday 23:59:59.999 in Asia/Manila. */
export function weekStart(now = new Date()) {
  const weekday = new Date(now.getTime() + MANILA_OFFSET).getUTCDay();
  return new Date(dayStart(now).getTime() - ((weekday + 6) % 7) * DAY_MS);
}

export function weekEnd(now = new Date()) {
  return new Date(weekStart(now).getTime() + 7 * DAY_MS - 1);
}

/** A weekly tag features a challenge only in its publication week; newest publication wins. */
export function currentWeekly<T extends { id: string; tags: string[]; publishedAt: Date | null }>(items: T[], now = new Date()): T | undefined {
  const start = weekStart(now).getTime();
  return items.filter(c => c.tags.some(t => t.toLowerCase() === "weekly") && c.publishedAt && c.publishedAt.getTime() >= start && c.publishedAt <= now)
    .sort((a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime() || a.id.localeCompare(b.id))[0];
}

export function countdownParts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(total / 86400), hours: Math.floor(total / 3600) % 24, minutes: Math.floor(total / 60) % 60, seconds: total % 60 };
}

/** Manila calendar day, independent of the server or browser timezone. */
export function dayKey(date: Date) { return new Date(date.getTime() + MANILA_OFFSET).toISOString().slice(0, 10); }
