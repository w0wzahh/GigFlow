import { db } from "@/lib/db";
import { withAuth, parseBody, errors, ok, assertSameOrigin } from "@/lib/api";
import { earningSchema } from "@/lib/schemas";

type Params = { id: string };

export const PATCH = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const existing = await db.earning.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) throw errors.notFound("Earning");
  const body = await parseBody(req, earningSchema.partial());
  const earning = await db.earning.update({
    where: { id: existing.id },
    data: { ...body, ...(body.earnedAt ? { earnedAt: new Date(body.earnedAt) } : {}) },
  });
  return ok(earning);
});

export const DELETE = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const existing = await db.earning.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) throw errors.notFound("Earning");
  await db.earning.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
});
