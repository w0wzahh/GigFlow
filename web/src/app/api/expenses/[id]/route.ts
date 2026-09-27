import { db } from "@/lib/db";
import { withAuth, parseBody, errors, ok, assertSameOrigin } from "@/lib/api";
import { expenseSchema } from "@/lib/schemas";

type Params = { id: string };

export const PATCH = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const existing = await db.expense.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) throw errors.notFound("Expense");
  const body = await parseBody(req, expenseSchema.partial());
  const expense = await db.expense.update({
    where: { id: existing.id },
    data: { ...body, ...(body.occurredAt ? { occurredAt: new Date(body.occurredAt) } : {}) },
  });
  return ok(expense);
});

export const DELETE = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const existing = await db.expense.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) throw errors.notFound("Expense");
  await db.expense.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
});
