import { db } from "@/lib/db";
import { periodRange, previousRange, type RangeKey } from "@/lib/dates";
import {
  summarize, platformBreakdown, dailySeries, expenseByCategory, buildInsights,
} from "@/lib/metrics";
import { formatMoney, kmToUnit } from "@/lib/units";

export async function getAnalyticsData(
  userId: string,
  opts: {
    rangeKey: RangeKey;
    start?: string;
    end?: string;
    platformId?: string;
    vehicleId?: string;
  },
) {
  const pref = await db.userPreference.findUnique({ where: { userId } });
  const tz = pref?.timezone ?? "UTC";
  const currency = pref?.currency ?? "USD";
  const unit = (pref?.distanceUnit ?? "MI") as "MI" | "KM";

  const range = periodRange(opts.rangeKey, tz, { start: opts.start, end: opts.end });
  const filter = { range, platformId: opts.platformId, vehicleId: opts.vehicleId };
  const prev = range ? previousRange(range) : null;

  const [current, previous, byPlatform, series, expenseCats, vehicles, platforms] =
    await Promise.all([
      summarize(userId, filter),
      prev ? summarize(userId, { ...filter, range: prev }) : Promise.resolve(null),
      platformBreakdown(userId, filter),
      dailySeries(userId, filter, tz),
      expenseByCategory(userId, filter),
      db.vehicle.findMany({ where: { userId }, select: { id: true, nickname: true } }),
      db.platform.findMany({ select: { id: true, name: true, color: true } }),
    ]);

  // Day-of-week and hour-of-day aggregates (SQLite date functions).
  const rangeClause = range ? "AND startedAt BETWEEN ? AND ?" : "";
  const rangeArgs = range ? [range.start.getTime(), range.end.getTime()] : [];
  const workItems = await db.$queryRawUnsafe<
    { day: number; hour: number; jobs: bigint; grossCents: bigint | null }[]
  >(
    `SELECT CAST(strftime('%w', startedAt/1000, 'unixepoch') AS INTEGER) AS day,
            CAST(strftime('%H', startedAt/1000, 'unixepoch') AS INTEGER) AS hour,
            COUNT(*) AS jobs,
            SUM(payoutCents + tipCents + bonusCents) AS grossCents
     FROM (
       SELECT startedAt, payoutCents, tipCents, bonusCents FROM Trip
       WHERE userId = ? AND status = 'COMPLETED' ${rangeClause}
       UNION ALL
       SELECT startedAt, payoutCents, tipCents, bonusCents FROM Delivery
       WHERE userId = ? AND status = 'COMPLETED' ${rangeClause}
     )
     GROUP BY day, hour`,
    userId, ...rangeArgs, userId, ...rangeArgs,
  ).catch(() => [] as { day: number; hour: number; jobs: bigint; grossCents: bigint | null }[]);

  const byDayOfWeek = Array.from({ length: 7 }, (_, day) => ({ day, jobs: 0, grossCents: 0 }));
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, jobs: 0, grossCents: 0 }));
  for (const row of workItems) {
    const j = Number(row.jobs);
    const g = Number(row.grossCents ?? 0);
    byDayOfWeek[row.day].jobs += j;
    byDayOfWeek[row.day].grossCents += g;
    byHour[row.hour].jobs += j;
    byHour[row.hour].grossCents += g;
  }

  return {
    range: range ? { start: range.start.toISOString(), end: range.end.toISOString() } : null,
    currency,
    distanceUnit: unit,
    current: {
      ...current,
      distance: kmToUnit(current.distanceKm, unit),
      perDistanceCents:
        current.distanceKm > 0 ? Math.round(current.grossCents / kmToUnit(current.distanceKm, unit)) : null,
    },
    previous,
    byPlatform,
    series,
    expenseCategories: expenseCats,
    byDayOfWeek,
    byHour,
    insights: buildInsights(current, previous, (c) => formatMoney(c, currency)),
    filters: { vehicles, platforms },
  };
}

export type AnalyticsData = Awaited<ReturnType<typeof getAnalyticsData>>;
