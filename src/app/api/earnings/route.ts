import { db } from "@/lib/db";
import { withAuth, parseBody, ok, assertSameOrigin } from "@/lib/api";
import { earningSchema } from "@/lib/schemas";
import { periodRange, type RangeKey } from "@/lib/dates";
import { checkMilestones } from "@/lib/notifications";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const range = url.searchParams.get("range") as RangeKey | null;
  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });
  const period = periodRange(range ?? "month", pref?.timezone ?? "UTC", {
    start: url.searchParams.get("start") ?? undefined,
    end: url.searchParams.get("end") ?? undefined,
  });
  const platformId = url.searchParams.get("platformId") ?? undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 25)));

  const where = {
    userId: user.id,
    ...(period ? { earnedAt: { gte: period.start, lte: period.end } } : {}),
    ...(platformId ? { platformId } : {}),
  };
  const [items, total] = await Promise.all([
    db.earning.findMany({
      where,
      include: { platform: { select: { name: true, color: true } } },
      orderBy: { earnedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.earning.count({ where }),
  ]);
  return ok({ items, total, page, pageSize });
});

export const POST = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const body = await parseBody(req, earningSchema);
  const earning = await db.earning.create({
    data: { ...body, earnedAt: new Date(body.earnedAt), userId: user.id },
  });
  await checkMilestones(user.id);
  return ok(earning);
});
