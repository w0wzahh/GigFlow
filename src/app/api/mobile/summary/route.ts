import { withErrors, ok } from "@/lib/api";
import { getMobileUser } from "@/lib/mobile";
import { getDashboardData } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { periodRange } from "@/lib/dates";

/**
 * GET /api/mobile/summary — compact dashboard payload for the companion app.
 * Returns the same aggregates the web dashboard computes, trimmed to what a
 * phone needs.
 */
export const GET = withErrors(async (req) => {
  const user = await getMobileUser(req);
  const d = await getDashboardData(user.id);

  const pref = await db.userPreference.findUnique({
    where: { userId: user.id },
    select: { timezone: true },
  });
  const today = periodRange("today", pref?.timezone ?? "UTC");
  const offersToday = await db.offer.count({
    where: {
      userId: user.id,
      receivedAt: { gte: today?.start ?? new Date(0), lte: today?.end ?? new Date() },
    },
  });

  return ok({
    currency: d.currency,
    distanceUnit: d.distanceUnit,
    today: {
      grossCents: d.today.grossCents,
      netCents: d.today.netCents,
      expensesCents: d.today.expensesCents,
      hours: d.today.hours,
      distanceKm: d.today.distanceKm,
      perHourCents: d.today.perHourCents,
      perKmCents: d.today.perKmCents,
      offers: offersToday,
    },
    week: {
      grossCents: d.week.grossCents,
      netCents: d.week.netCents,
      expensesCents: d.week.expensesCents,
      hours: d.week.hours,
      distanceKm: d.week.distanceKm,
      perHourCents: d.week.perHourCents,
    },
    series: d.series.slice(-7).map((p) => ({
      date: p.date,
      grossCents: p.grossCents,
    })),
    insights: d.insights.slice(0, 3),
  });
});
