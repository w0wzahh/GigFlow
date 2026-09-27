import { db } from "@/lib/db";
import { withAuth, parseBody, ok, assertSameOrigin } from "@/lib/api";
import { goalSchema } from "@/lib/schemas";
import { periodRange } from "@/lib/dates";
import { summarize } from "@/lib/metrics";

export const GET = withAuth(async (_req, { user }) => {
  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });
  const tz = pref?.timezone ?? "UTC";
  const goals = await db.goal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  const withProgress = await Promise.all(
    goals.map(async (g) => {
      const range =
        g.period === "CUSTOM"
          ? g.startDate && g.endDate
            ? { start: g.startDate, end: g.endDate }
            : null
          : periodRange(
              { DAILY: "today", WEEKLY: "week", MONTHLY: "month" }[g.period] as "today" | "week" | "month",
              tz,
            );
      const s = await summarize(user.id, { range });
      return { ...g, progressCents: s.grossCents, progressPct: Math.min(100, (s.grossCents / g.targetCents) * 100) };
    }),
  );
  return ok(withProgress);
});

export const POST = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const body = await parseBody(req, goalSchema);
  const goal = await db.goal.create({
    data: {
      ...body,
      userId: user.id,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
    },
  });
  return ok(goal);
});
