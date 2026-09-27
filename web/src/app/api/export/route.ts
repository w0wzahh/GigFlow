import { db } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { NextResponse } from "next/server";

/** Full data export (JSON). Everything belonging to the user, nothing else. */
export const GET = withAuth(async (_req, { user }) => {
  const [
    account, preferences, vehicles, connections, trips, deliveries,
    offers, earnings, expenses, mileage, goals, rules, schedule, notifications,
  ] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { id: true, email: true, name: true, createdAt: true },
    }),
    db.userPreference.findUnique({ where: { userId: user.id } }),
    db.vehicle.findMany({ where: { userId: user.id } }),
    db.platformConnection.findMany({
      where: { userId: user.id },
      select: { id: true, status: true, lastSyncAt: true, createdAt: true, platform: { select: { key: true, name: true } } },
    }),
    db.trip.findMany({ where: { userId: user.id } }),
    db.delivery.findMany({ where: { userId: user.id } }),
    db.offer.findMany({ where: { userId: user.id } }),
    db.earning.findMany({ where: { userId: user.id } }),
    db.expense.findMany({ where: { userId: user.id } }),
    db.mileageRecord.findMany({ where: { userId: user.id } }),
    db.goal.findMany({ where: { userId: user.id } }),
    db.rule.findMany({ where: { userId: user.id } }),
    db.scheduleEntry.findMany({ where: { userId: user.id } }),
    db.notification.findMany({ where: { userId: user.id } }),
  ]);

  // Credentials are never exported — they are encrypted server-side secrets.
  const payload = {
    exportedAt: new Date().toISOString(),
    product: "GigFlow",
    account, preferences, vehicles, platformConnections: connections,
    trips, deliveries, offers, earnings, expenses, mileageRecords: mileage,
    goals, rules, schedule, notifications,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="gigflow-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
