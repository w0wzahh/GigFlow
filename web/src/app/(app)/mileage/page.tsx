import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { periodRange, type RangeKey } from "@/lib/dates";
import { MileageView } from "@/components/mileage-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mileage" };
export const dynamic = "force-dynamic";

export default async function MileagePage({ searchParams }: PageProps<"/mileage">) {
  const user = await requireUser();
  const sp = await searchParams;
  const rangeKey = (typeof sp.range === "string" ? sp.range : "month") as RangeKey;
  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });
  const range = periodRange(rangeKey, pref?.timezone ?? "UTC");

  const where = { userId: user.id, ...(range ? { date: { gte: range.start, lte: range.end } } : {}) };
  const [records, totals, vehicles] = await Promise.all([
    db.mileageRecord.findMany({
      where,
      include: { vehicle: { select: { nickname: true } } },
      orderBy: { date: "desc" },
      take: 300,
    }),
    db.mileageRecord.groupBy({
      by: ["purpose"],
      where,
      _sum: { distanceKm: true },
    }),
    db.vehicle.findMany({ where: { userId: user.id }, select: { id: true, nickname: true } }),
  ]);

  return (
    <MileageView
      currency={pref?.currency ?? "USD"}
      distanceUnit={(pref?.distanceUnit ?? "MI") as "MI" | "KM"}
      rangeKey={rangeKey}
      records={records.map((r) => ({ ...r, date: r.date.toISOString(), createdAt: r.createdAt.toISOString() }))}
      totals={totals.map((t) => ({ purpose: t.purpose, km: t._sum.distanceKm ?? 0 }))}
      vehicles={vehicles}
    />
  );
}
