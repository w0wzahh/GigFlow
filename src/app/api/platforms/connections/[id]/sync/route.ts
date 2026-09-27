import { db } from "@/lib/db";
import { withAuth, errors, ok, assertSameOrigin } from "@/lib/api";
import { getAdapter } from "@/lib/integrations/registry";
import { notify } from "@/lib/notifications";

type Params = { id: string };

/** Run an incremental sync through the platform's adapter. */
export const POST = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const conn = await db.platformConnection.findFirst({
    where: { id: params.id, userId: user.id },
    include: { platform: true },
  });
  if (!conn) throw errors.notFound("Connection");
  const adapter = getAdapter(conn.platform.adapterKey);
  if (!adapter || !adapter.capabilities.canSyncTrips) {
    throw errors.badRequest(`${conn.platform.name} does not support sync.`);
  }

  try {
    const result = await adapter.sync({
      userId: user.id,
      connectionId: conn.id,
      since: conn.lastSyncAt ?? undefined,
    });

    // Persist synced records. All adapter output is marked source=SYNC.
    const source = "SYNC";
    let imported = 0;
    for (const t of result.trips) {
      const exists = await db.trip.findFirst({
        where: { userId: user.id, externalId: t.externalId },
      });
      if (exists) continue;
      await db.trip.create({
        data: {
          userId: user.id,
          platformId: conn.platformId,
          platformConnectionId: conn.id,
          externalId: t.externalId,
          startedAt: t.startedAt,
          endedAt: t.endedAt ?? null,
          distanceKm: t.distanceKm,
          durationMin: t.durationMin,
          pickupZone: t.pickupZone,
          dropoffZone: t.dropoffZone,
          payoutCents: t.payoutCents,
          tipCents: t.tipCents ?? 0,
          bonusCents: t.bonusCents ?? 0,
          status: t.status,
          source,
        },
      });
      imported++;
    }
    for (const e of result.earnings) {
      if (e.externalId) {
        const exists = await db.earning.findFirst({
          where: { userId: user.id, notes: `ext:${e.externalId}` },
        });
        if (exists) continue;
      }
      await db.earning.create({
        data: {
          userId: user.id,
          platformId: conn.platformId,
          category: e.category,
          amountCents: e.amountCents,
          tipCents: e.tipCents ?? 0,
          bonusCents: e.bonusCents ?? 0,
          earnedAt: e.earnedAt,
          hours: e.hours ?? 0,
          distanceKm: e.distanceKm ?? 0,
          notes: e.externalId ? `ext:${e.externalId}` : null,
          source,
        },
      });
    }

    await db.platformConnection.update({
      where: { id: conn.id },
      data: { lastSyncAt: new Date(), lastError: null, status: "CONNECTED" },
    });
    return ok({ imported, earnings: result.earnings.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    await db.platformConnection.update({
      where: { id: conn.id },
      data: { status: "ERROR", lastError: message },
    });
    await notify(user.id, "SYNC_FAILURE", `${conn.platform.name} sync failed`, message);
    throw errors.badRequest(`Sync failed: ${message}`);
  }
});
