import { db } from "@/lib/db";
import { withAuth, parseBody, ok, assertSameOrigin } from "@/lib/api";
import { expenseSchema } from "@/lib/schemas";
import { periodRange, type RangeKey } from "@/lib/dates";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });
  const period = periodRange((url.searchParams.get("range") as RangeKey) ?? "month", pref?.timezone ?? "UTC", {
    start: url.searchParams.get("start") ?? undefined,
    end: url.searchParams.get("end") ?? undefined,
  });
  const category = url.searchParams.get("category") ?? undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 25)));

  const where = {
    userId: user.id,
    ...(period ? { occurredAt: { gte: period.start, lte: period.end } } : {}),
    ...(category ? { category } : {}),
  };
  const [items, total] = await Promise.all([
    db.expense.findMany({
      where,
      include: { vehicle: { select: { nickname: true } } },
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.expense.count({ where }),
  ]);
  return ok({ items, total, page, pageSize });
});

export const POST = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const body = await parseBody(req, expenseSchema);
  const expense = await db.expense.create({
    data: { ...body, occurredAt: new Date(body.occurredAt), userId: user.id },
  });
  return ok(expense);
});
