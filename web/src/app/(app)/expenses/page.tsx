import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { periodRange, type RangeKey } from "@/lib/dates";
import { expenseByCategory } from "@/lib/metrics";
import { ExpensesView } from "@/components/expenses-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Expenses" };
export const dynamic = "force-dynamic";

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const user = await requireUser();
  const sp = await searchParams;
  const rangeKey = (typeof sp.range === "string" ? sp.range : "month") as RangeKey;
  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });
  const range = periodRange(rangeKey, pref?.timezone ?? "UTC", {
    start: typeof sp.start === "string" ? sp.start : undefined,
    end: typeof sp.end === "string" ? sp.end : undefined,
  });

  const [expenses, byCategory, vehicles] = await Promise.all([
    db.expense.findMany({
      where: { userId: user.id, ...(range ? { occurredAt: { gte: range.start, lte: range.end } } : {}) },
      include: { vehicle: { select: { nickname: true } } },
      orderBy: { occurredAt: "desc" },
      take: 300,
    }),
    expenseByCategory(user.id, { range }),
    db.vehicle.findMany({ where: { userId: user.id }, select: { id: true, nickname: true } }),
  ]);

  return (
    <ExpensesView
      currency={pref?.currency ?? "USD"}
      rangeKey={rangeKey}
      expenses={expenses.map((e) => ({ ...e, occurredAt: e.occurredAt.toISOString(), createdAt: e.createdAt.toISOString() }))}
      byCategory={byCategory}
      vehicles={vehicles}
    />
  );
}
