import { db } from "@/lib/db";
import { withAuth, parseBody, ok, assertSameOrigin } from "@/lib/api";
import { activitySchema } from "@/lib/schemas";
import { checkMilestones } from "@/lib/notifications";

/** Recent activity feed: trips + deliveries + expenses merged by time. */
export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const limit = Math.min(50, Number(url.searchParams.get("limit") ?? 15));
  const [trips, deliveries, expenses] = await Promise.all([
    db.trip.findMany({
      where: { userId: user.id },
      include: { platform: { select: { name: true, color: true } } },
      orderBy: { startedAt: "desc" },
      take: limit,
    }),
    db.delivery.findMany({
      where: { userId: user.id },
      include: { platform: { select: { name: true, color: true } } },
      orderBy: { startedAt: "desc" },
      take: limit,
    }),
    db.expense.findMany({
      where: { userId: user.id },
      orderBy: { occurredAt: "desc" },
      take: limit,
    }),
  ]);
  const items = [
    ...trips.map((t) => ({ type: "TRIP" as const, at: t.startedAt, record: t })),
    ...deliveries.map((d) => ({ type: "DELIVERY" as const, at: d.startedAt, record: d })),
    ...expenses.map((e) => ({ type: "EXPENSE" as const, at: e.occurredAt, record: e })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
  return ok(items);
});

/** Record a completed trip or delivery (+ its earning, atomically). */
export const POST = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const body = await parseBody(req, activitySchema);
  const { kind, ...rest } = body;
  const data = {
    ...rest,
    startedAt: new Date(rest.startedAt),
    endedAt: rest.endedAt ? new Date(rest.endedAt) : null,
    userId: user.id,
    source: "MANUAL",
  };

  const result = await db.$transaction(async (tx) => {
    const record =
      kind === "TRIP"
        ? await tx.trip.create({ data })
        : await tx.delivery.create({ data: { ...data, itemsCount: body.itemsCount ?? null } });
    const earning = await tx.earning.create({
      data: {
        userId: user.id,
        platformId: body.platformId ?? null,
        category: kind,
        amountCents: body.payoutCents,
        tipCents: body.tipCents,
        bonusCents: body.bonusCents,
        earnedAt: data.startedAt,
        hours: body.durationMin / 60,
        distanceKm: body.distanceKm,
      },
    });
    return { record, earning };
  });
  await checkMilestones(user.id);
  return ok(result);
});
