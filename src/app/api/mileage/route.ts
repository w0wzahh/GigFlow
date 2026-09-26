import { db } from "@/lib/db";
import { withAuth, parseBody, ok, assertSameOrigin } from "@/lib/api";
import { mileageSchema } from "@/lib/schemas";
import { periodRange, type RangeKey } from "@/lib/dates";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });
  const period = periodRange((url.searchParams.get("range") as RangeKey) ?? "month", pref?.timezone ?? "UTC", {
    start: url.searchParams.get("start") ?? undefined,
    end: url.searchParams.get("end") ?? undefined,
  });
  const purpose = url.searchParams.get("purpose") ?? undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 25)));

  const where = {
    userId: user.id,
    ...(period ? { date: { gte: period.start, lte: period.end } } : {}),
    ...(purpose ? { purpose } : {}),
  };
  const [items, total] = await Promise.all([
    db.mileageRecord.findMany({
      where,
      include: { vehicle: { select: { nickname: true } } },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.mileageRecord.count({ where }),
  ]);
  return ok({ items, total, page, pageSize });
});

export const POST = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const body = await parseBody(req, mileageSchema);
  const record = await db.mileageRecord.create({
    data: { ...body, date: new Date(body.date), userId: user.id },
  });
  return ok(record);
});
