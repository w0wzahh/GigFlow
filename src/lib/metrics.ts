import { db } from "@/lib/db";
import type { DateRange } from "@/lib/dates";

/**
 * Metrics engine. All numbers are computed from stored records — nothing is
 * fabricated. Money in cents; distance in km; duration in minutes.
 */

export type PeriodFilter = {
  range: DateRange | null; // null = all time
  platformId?: string;
  vehicleId?: string;
};

export type MetricsSummary = {
  grossCents: number;
  tipsCents: number;
  bonusesCents: number;
  adjustmentsCents: number;
  expensesCents: number;
  netCents: number;
  hours: number;
  distanceKm: number;
  trips: number;
  deliveries: number;
  perHourCents: number | null;
  perKmCents: number | null;
  avgTripCents: number | null;
};

function earningWhere(userId: string, f: PeriodFilter) {
  return {
    userId,
    ...(f.range ? { earnedAt: { gte: f.range.start, lte: f.range.end } } : {}),
    ...(f.platformId ? { platformId: f.platformId } : {}),
  };
}

function tripWhere(userId: string, f: PeriodFilter) {
  return {
    userId,
    status: "COMPLETED",
    ...(f.range ? { startedAt: { gte: f.range.start, lte: f.range.end } } : {}),
    ...(f.platformId ? { platformId: f.platformId } : {}),
    ...(f.vehicleId ? { vehicleId: f.vehicleId } : {}),
  };
}

function deliveryWhere(userId: string, f: PeriodFilter) {
  return {
    userId,
    status: "COMPLETED",
    ...(f.range ? { startedAt: { gte: f.range.start, lte: f.range.end } } : {}),
    ...(f.platformId ? { platformId: f.platformId } : {}),
    ...(f.vehicleId ? { vehicleId: f.vehicleId } : {}),
  };
}

function expenseWhere(userId: string, f: PeriodFilter) {
  return {
    userId,
    ...(f.range ? { occurredAt: { gte: f.range.start, lte: f.range.end } } : {}),
    ...(f.vehicleId ? { vehicleId: f.vehicleId } : {}),
  };
}

function mileageWhere(userId: string, f: PeriodFilter) {
  return {
    userId,
    ...(f.range ? { date: { gte: f.range.start, lte: f.range.end } } : {}),
    ...(f.vehicleId ? { vehicleId: f.vehicleId } : {}),
  };
}

export async function summarize(userId: string, f: PeriodFilter): Promise<MetricsSummary> {
  const [earnings, expenses, tripsAgg, tripsCount, delAgg, delCount, mileage] =
    await Promise.all([
      db.earning.aggregate({
        where: earningWhere(userId, f),
        _sum: {
          amountCents: true,
          tipCents: true,
          bonusCents: true,
          adjustmentsCents: true,
          hours: true,
        },
      }),
      db.expense.aggregate({
        where: expenseWhere(userId, f),
        _sum: { amountCents: true },
      }),
      db.trip.aggregate({
        where: tripWhere(userId, f),
        _sum: { distanceKm: true, durationMin: true },
      }),
      db.trip.count({ where: tripWhere(userId, f) }),
      db.delivery.aggregate({
        where: deliveryWhere(userId, f),
        _sum: { distanceKm: true, durationMin: true },
      }),
      db.delivery.count({ where: deliveryWhere(userId, f) }),
      db.mileageRecord.aggregate({
        where: mileageWhere(userId, f),
        _sum: { distanceKm: true },
      }),
    ]);

  const grossCents =
    (earnings._sum.amountCents ?? 0) +
    (earnings._sum.tipCents ?? 0) +
    (earnings._sum.bonusCents ?? 0) +
    (earnings._sum.adjustmentsCents ?? 0);
  const expensesCents = expenses._sum.amountCents ?? 0;
  // Hours: explicit earning hours take precedence; fall back to trip/delivery durations.
  const trackedMin =
    (tripsAgg._sum.durationMin ?? 0) + (delAgg._sum.durationMin ?? 0);
  const hours = (earnings._sum.hours ?? 0) > 0
    ? (earnings._sum.hours ?? 0)
    : trackedMin / 60;
  const workDistance =
    (tripsAgg._sum.distanceKm ?? 0) + (delAgg._sum.distanceKm ?? 0);
  const recordedKm = mileage._sum.distanceKm ?? 0;
  const distanceKm = Math.max(workDistance, recordedKm > 0 ? recordedKm : 0) || workDistance;
  const jobs = tripsCount + delCount;

  return {
    grossCents,
    tipsCents: earnings._sum.tipCents ?? 0,
    bonusesCents: earnings._sum.bonusCents ?? 0,
    adjustmentsCents: earnings._sum.adjustmentsCents ?? 0,
    expensesCents,
    netCents: grossCents - expensesCents,
    hours,
    distanceKm,
    trips: tripsCount,
    deliveries: delCount,
    perHourCents: hours > 0 ? Math.round(grossCents / hours) : null,
    perKmCents: distanceKm > 0 ? Math.round(grossCents / distanceKm) : null,
    avgTripCents: jobs > 0 ? Math.round(grossCents / jobs) : null,
  };
}

export type PlatformBreakdownRow = {
  platformId: string | null;
  name: string;
  color: string;
  grossCents: number;
  jobs: number;
};

export async function platformBreakdown(
  userId: string,
  f: PeriodFilter,
): Promise<PlatformBreakdownRow[]> {
  const rows = await db.earning.groupBy({
    by: ["platformId"],
    where: earningWhere(userId, f),
    _sum: {
      amountCents: true, tipCents: true, bonusCents: true, adjustmentsCents: true,
    },
    _count: { _all: true },
  });
  const platformIds = rows.map((r) => r.platformId).filter((x): x is string => !!x);
  const platforms = await db.platform.findMany({
    where: { id: { in: platformIds } },
  });
  const byId = new Map(platforms.map((p) => [p.id, p]));
  return rows
    .map((r) => {
      const p = r.platformId ? byId.get(r.platformId) : undefined;
      return {
        platformId: r.platformId,
        name: p?.name ?? "Other",
        color: p?.color ?? "#64748b",
        grossCents:
          (r._sum.amountCents ?? 0) +
          (r._sum.tipCents ?? 0) +
          (r._sum.bonusCents ?? 0) +
          (r._sum.adjustmentsCents ?? 0),
        jobs: r._count._all,
      };
    })
    .sort((a, b) => b.grossCents - a.grossCents);
}

export type DailyPoint = {
  date: string; // ISO date in user tz
  grossCents: number;
  expensesCents: number;
  hours: number;
  distanceKm: number;
};

/** Daily earnings/expense series for charting, keyed on local dates. */
export async function dailySeries(
  userId: string,
  f: PeriodFilter,
  timeZone: string,
): Promise<DailyPoint[]> {
  const [earnings, expenses] = await Promise.all([
    db.earning.findMany({
      where: earningWhere(userId, f),
      select: { earnedAt: true, amountCents: true, tipCents: true, bonusCents: true, adjustmentsCents: true, hours: true, distanceKm: true },
    }),
    db.expense.findMany({
      where: expenseWhere(userId, f),
      select: { occurredAt: true, amountCents: true },
    }),
  ]);
  const trips = await db.trip.findMany({
    where: tripWhere(userId, f),
    select: { startedAt: true, durationMin: true, distanceKm: true },
  });
  const deliveries = await db.delivery.findMany({
    where: deliveryWhere(userId, f),
    select: { startedAt: true, durationMin: true, distanceKm: true },
  });

  const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const key = (d: Date) => dayFmt.format(d);
  const map = new Map<string, DailyPoint>();
  const get = (d: Date) => {
    const k = key(d);
    let p = map.get(k);
    if (!p) {
      p = { date: k, grossCents: 0, expensesCents: 0, hours: 0, distanceKm: 0 };
      map.set(k, p);
    }
    return p;
  };
  for (const e of earnings) {
    const p = get(e.earnedAt);
    p.grossCents += e.amountCents + e.tipCents + e.bonusCents + e.adjustmentsCents;
    p.hours += e.hours;
    p.distanceKm += e.distanceKm;
  }
  for (const x of expenses) get(x.occurredAt).expensesCents += x.amountCents;
  for (const t of trips) {
    const p = get(t.startedAt);
    if (earnings.every((e) => e.hours === 0)) p.hours += t.durationMin / 60;
    p.distanceKm += t.distanceKm;
  }
  for (const t of deliveries) {
    const p = get(t.startedAt);
    if (earnings.every((e) => e.hours === 0)) p.hours += t.durationMin / 60;
    p.distanceKm += t.distanceKm;
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type ExpenseCategoryRow = { category: string; amountCents: number };

export async function expenseByCategory(
  userId: string,
  f: PeriodFilter,
): Promise<ExpenseCategoryRow[]> {
  const rows = await db.expense.groupBy({
    by: ["category"],
    where: expenseWhere(userId, f),
    _sum: { amountCents: true },
  });
  return rows
    .map((r) => ({ category: r.category, amountCents: r._sum.amountCents ?? 0 }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

/** Plain-language insights derived from real aggregates only. */
export function buildInsights(
  current: MetricsSummary,
  previous: MetricsSummary | null,
  fmtMoney: (c: number) => string,
): string[] {
  const insights: string[] = [];
  if (previous && previous.hours > 0 && current.perHourCents && previous.perHourCents) {
    const delta = ((current.perHourCents - previous.perHourCents) / previous.perHourCents) * 100;
    if (Math.abs(delta) >= 3) {
      insights.push(
        `Your earnings per hour ${delta > 0 ? "increased" : "decreased"} ${Math.abs(delta).toFixed(0)}% versus the previous period (${fmtMoney(current.perHourCents)}/h vs ${fmtMoney(previous.perHourCents)}/h).`,
      );
    }
  }
  if (previous && previous.grossCents > 0) {
    const delta = ((current.grossCents - previous.grossCents) / previous.grossCents) * 100;
    if (Math.abs(delta) >= 5) {
      insights.push(
        `Gross earnings are ${delta > 0 ? "up" : "down"} ${Math.abs(delta).toFixed(0)}% compared with the previous period.`,
      );
    }
  }
  if (current.expensesCents > 0 && current.grossCents > 0) {
    const ratio = current.expensesCents / current.grossCents;
    if (ratio > 0.35) {
      insights.push(
        `Expenses consumed ${(ratio * 100).toFixed(0)}% of gross earnings this period — review fuel and maintenance costs.`,
      );
    }
  }
  if (current.perHourCents && current.hours >= 10 && current.grossCents > 0) {
    insights.push(
      `You averaged ${fmtMoney(current.perHourCents)}/h across ${current.hours.toFixed(1)} tracked hours.`,
    );
  }
  if (current.tipsCents > 0 && current.grossCents > 0) {
    const tipShare = (current.tipsCents / current.grossCents) * 100;
    if (tipShare >= 15) {
      insights.push(`Tips made up ${tipShare.toFixed(0)}% of gross earnings this period.`);
    }
  }
  return insights;
}
