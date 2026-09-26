import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { computeOfferMetrics } from "@/lib/rules/engine";
import { OffersView } from "@/components/offers-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offers" };
export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const user = await requireUser();
  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });
  const unit = (pref?.distanceUnit ?? "MI") as "MI" | "KM";

  const [offers, platforms] = await Promise.all([
    db.offer.findMany({
      where: { userId: user.id },
      include: { platform: { select: { id: true, name: true, color: true, key: true } } },
      orderBy: { receivedAt: "desc" },
      take: 100,
    }),
    db.platform.findMany({ select: { id: true, name: true } }),
  ]);

  return (
    <OffersView
      currency={pref?.currency ?? "USD"}
      distanceUnit={unit}
      platforms={platforms}
      offers={offers.map((o) => ({
        id: o.id,
        platform: o.platform,
        pickup: o.pickup, destination: o.destination,
        estDistanceKm: o.estDistanceKm, estDurationMin: o.estDurationMin,
        payoutCents: o.payoutCents, tipCents: o.tipCents,
        estExpensesCents: o.estExpensesCents,
        status: o.status, evalLabel: o.evalLabel, source: o.source,
        receivedAt: o.receivedAt.toISOString(),
        metrics: computeOfferMetrics({
          platformName: o.platform?.name, payoutCents: o.payoutCents,
          tipCents: o.tipCents, estDistanceKm: o.estDistanceKm, estDurationMin: o.estDurationMin,
        }),
      }))}
    />
  );
}
