import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { periodRange, type RangeKey } from "@/lib/dates";
import { summarize, platformBreakdown, dailySeries } from "@/lib/metrics";
import { EarningsView } from "@/components/earnings-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Earnings" };
export const dynamic = "force-dynamic";

export default async function EarningsPage({
  searchParams,
}: PageProps<"/earnings">) {
  const user = await requireUser();
  const sp = await searchParams;
  const rangeKey = (typeof sp.range === "string" ? sp.range : "month") as RangeKey;

  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });
  const tz = pref?.timezone ?? "UTC";
  const range = periodRange(rangeKey, tz, {
    start: typeof sp.start === "string" ? sp.start : undefined,
    end: typeof sp.end === "string" ? sp.end : undefined,
  });
  const filter = { range };

  const [summary, byPlatform, series, earnings, platforms] = await Promise.all([
    summarize(user.id, filter),
    platformBreakdown(user.id, filter),
    dailySeries(user.id, filter, tz),
    db.earning.findMany({
      where: { userId: user.id, ...(range ? { earnedAt: { gte: range.start, lte: range.end } } : {}) },
      include: { platform: { select: { id: true, name: true, color: true } } },
      orderBy: { earnedAt: "desc" },
      take: 200,
    }),
    db.platform.findMany({ select: { id: true, name: true } }),
  ]);

  return (
    <EarningsView
      currency={pref?.currency ?? "USD"}
      distanceUnit={(pref?.distanceUnit ?? "MI") as "MI" | "KM"}
      rangeKey={rangeKey}
      summary={summary}
      byPlatform={byPlatform}
      series={series}
      earnings={earnings.map((e) => ({
        ...e,
        earnedAt: e.earnedAt.toISOString(),
        createdAt: e.createdAt.toISOString(),
      }))}
      platforms={platforms}
    />
  );
}
