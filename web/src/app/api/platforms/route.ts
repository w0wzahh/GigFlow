import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api";
import { ensurePlatformCatalog } from "@/lib/catalog";

export const GET = withAuth(async (_req, { user }) => {
  await ensurePlatformCatalog();
  const platforms = await db.platform.findMany({ orderBy: { name: "asc" } });
  const connections = await db.platformConnection.findMany({
    where: { userId: user.id },
    include: { platform: true },
  });
  const connByPlatform = new Map(connections.map((c) => [c.platformId, c]));

  // Per-platform earnings totals.
  const earnings = await db.earning.groupBy({
    by: ["platformId"],
    where: { userId: user.id },
    _sum: { amountCents: true, tipCents: true, bonusCents: true },
  });
  const grossByPlatform = new Map(
    earnings.map((e) => [
      e.platformId,
      (e._sum.amountCents ?? 0) + (e._sum.tipCents ?? 0) + (e._sum.bonusCents ?? 0),
    ]),
  );

  return ok(
    platforms.map((p) => {
      const c = connByPlatform.get(p.id);
      return {
        ...p,
        connection: c
          ? { id: c.id, status: c.status, lastSyncAt: c.lastSyncAt, lastError: c.lastError }
          : null,
        totalGrossCents: grossByPlatform.get(p.id) ?? 0,
      };
    }),
  );
});
