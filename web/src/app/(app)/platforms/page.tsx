import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { ensurePlatformCatalog } from "@/lib/catalog";
import { PlatformsView } from "@/components/platforms-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Platforms" };
export const dynamic = "force-dynamic";

export default async function PlatformsPage() {
  const user = await requireUser();
  await ensurePlatformCatalog();
  const platforms = await db.platform.findMany({ orderBy: { name: "asc" } });
  const connections = await db.platformConnection.findMany({
    where: { userId: user.id },
    include: { platform: true },
  });
  const earnings = await db.earning.groupBy({
    by: ["platformId"],
    where: { userId: user.id },
    _sum: { amountCents: true, tipCents: true, bonusCents: true },
  });
  const gross = new Map(earnings.map((e) => [
    e.platformId,
    (e._sum.amountCents ?? 0) + (e._sum.tipCents ?? 0) + (e._sum.bonusCents ?? 0),
  ]));
  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });

  return (
    <PlatformsView
      currency={pref?.currency ?? "USD"}
      platforms={platforms.map((p) => {
        const c = connections.find((x) => x.platformId === p.id);
        return {
          id: p.id, key: p.key, name: p.name, category: p.category,
          status: p.status, statusNote: p.statusNote, color: p.color,
          connection: c ? { id: c.id, status: c.status, lastSyncAt: c.lastSyncAt?.toISOString() ?? null, lastError: c.lastError } : null,
          totalGrossCents: gross.get(p.id) ?? 0,
        };
      })}
    />
  );
}
