import { db } from "@/lib/db";
import { periodRange, previousRange } from "@/lib/dates";
import { summarize, platformBreakdown, dailySeries, buildInsights } from "@/lib/metrics";
import { formatMoney, kmToUnit } from "@/lib/units";
import { hasDemoData } from "@/lib/demo";

/** Aggregated dashboard payload — used by both the page and /api/dashboard. */
export async function getDashboardData(userId: string) {
  const pref = await db.userPreference.findUnique({ where: { userId } });
  const tz = pref?.timezone ?? "UTC";
  const currency = pref?.currency ?? "USD";
  const unit = (pref?.distanceUnit ?? "MI") as "MI" | "KM";

  const today = periodRange("today", tz);
  const week = periodRange("week", tz);
  const month = periodRange("month", tz);
  const prevWeek = week ? previousRange(week) : null;

  const [
    todayS, weekS, monthS, prevWeekS,
    byPlatform, series, goals, connections, notifications,
    trips, deliveries, expenses, demo,
  ] = await Promise.all([
    summarize(userId, { range: today }),
    summarize(userId, { range: week }),
    summarize(userId, { range: month }),
    prevWeek ? summarize(userId, { range: prevWeek }) : Promise.resolve(null),
    platformBreakdown(userId, { range: month }),
    dailySeries(userId, { range: null }, tz),
    db.goal.findMany({ where: { userId, active: true }, orderBy: { createdAt: "asc" }, take: 3 }),
    db.platformConnection.findMany({ where: { userId }, include: { platform: true } }),
    db.notification.count({ where: { userId, readAt: null } }),
    db.trip.findMany({
      where: { userId },
      include: { platform: { select: { name: true, color: true } } },
      orderBy: { startedAt: "desc" }, take: 10,
    }),
    db.delivery.findMany({
      where: { userId },
      include: { platform: { select: { name: true, color: true } } },
      orderBy: { startedAt: "desc" }, take: 10,
    }),
    db.expense.findMany({ where: { userId }, orderBy: { occurredAt: "desc" }, take: 10 }),
    hasDemoData(userId),
  ]);

  const goalsWithProgress = await Promise.all(
    goals.map(async (g) => {
      const range =
        g.period === "WEEKLY" ? week : g.period === "DAILY" ? today : month;
      const s = await summarize(userId, { range });
      return {
        ...g,
        progressCents: s.grossCents,
        progressPct: Math.min(100, (s.grossCents / g.targetCents) * 100),
      };
    }),
  );

  const activity = [
    ...trips.map((t) => ({ type: "TRIP" as const, at: t.startedAt, record: t })),
    ...deliveries.map((d) => ({ type: "DELIVERY" as const, at: d.startedAt, record: d })),
    ...expenses.map((e) => ({ type: "EXPENSE" as const, at: e.occurredAt, record: e })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 10);

  const weekWithUnits = {
    ...weekS,
    distance: kmToUnit(weekS.distanceKm, unit),
    perDistanceCents:
      weekS.distanceKm > 0 ? Math.round(weekS.grossCents / kmToUnit(weekS.distanceKm, unit)) : null,
  };

  return {
    currency,
    distanceUnit: unit,
    today: todayS,
    week: weekWithUnits,
    month: monthS,
    prevWeek: prevWeekS,
    byPlatform,
    series: series.slice(-30),
    goals: goalsWithProgress,
    connections: connections.map((c) => ({
      id: c.id, status: c.status, lastSyncAt: c.lastSyncAt,
      platform: { name: c.platform.name, color: c.platform.color, key: c.platform.key, status: c.platform.status },
    })),
    activity,
    unreadNotifications: notifications,
    insights: buildInsights(weekS, prevWeekS, (c) => formatMoney(c, currency)),
    hasDemoData: demo,
  };
}

export type DashboardDataResult = Awaited<ReturnType<typeof getDashboardData>>;
