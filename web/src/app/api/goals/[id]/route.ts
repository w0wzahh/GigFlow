import { db } from "@/lib/db";
import { withAuth, parseBody, errors, ok, assertSameOrigin } from "@/lib/api";
import { goalSchema } from "@/lib/schemas";

type Params = { id: string };

export const PATCH = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const existing = await db.goal.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) throw errors.notFound("Goal");
  const body = await parseBody(req, goalSchema.partial());
  const goal = await db.goal.update({
    where: { id: existing.id },
    data: {
      ...body,
      startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : undefined,
      endDate: body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : undefined,
    },
  });
  return ok(goal);
});

export const DELETE = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const existing = await db.goal.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) throw errors.notFound("Goal");
  await db.goal.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
});
