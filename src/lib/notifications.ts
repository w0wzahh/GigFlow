import { db } from "@/lib/db";

export type NotificationType =
  | "MILESTONE"
  | "GOAL"
  | "SYNC_FAILURE"
  | "ACCOUNT"
  | "RULE"
  | "PLATFORM"
  | "SYSTEM";

export async function notify(
  userId: string,
  type: NotificationType,
  title: string,
  body?: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const prefs = await db.userPreference.findUnique({ where: { userId } });
  let enabled = true;
  if (prefs?.notificationPrefsJson) {
    try {
      const parsed = JSON.parse(prefs.notificationPrefsJson) as Record<string, boolean>;
      if (parsed[type] === false) enabled = false;
    } catch { /* defaults on */ }
  }
  if (!enabled) return;
  await db.notification.create({
    data: { userId, type, title, body, dataJson: data ? JSON.stringify(data) : null },
  });
}

/** Check earning milestones after a new earning is recorded. */
export async function checkMilestones(userId: string): Promise<void> {
  const total = await db.earning.aggregate({
    where: { userId },
    _sum: { amountCents: true, tipCents: true, bonusCents: true },
  });
  const cents = (total._sum.amountCents ?? 0) + (total._sum.tipCents ?? 0) + (total._sum.bonusCents ?? 0);
  const milestones = [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];
  for (const m of milestones) {
    if (cents >= m) {
      const existing = await db.notification.findFirst({
        where: { userId, type: "MILESTONE", dataJson: { contains: `"milestone":${m}` } },
      });
      if (!existing) {
        await notify(userId, "MILESTONE", `You've earned $${(m / 100).toLocaleString()} in total`, "Lifetime gross earnings milestone reached.", { milestone: m });
      }
    }
  }
}
