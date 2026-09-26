import { db } from "@/lib/db";
import { withAuth, parseBody, errors, ok, assertSameOrigin } from "@/lib/api";
import { mileageSchema } from "@/lib/schemas";

type Params = { id: string };

export const PATCH = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const existing = await db.mileageRecord.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) throw errors.notFound("Mileage record");
  const body = await parseBody(req, mileageSchema.partial());
  const record = await db.mileageRecord.update({
    where: { id: existing.id },
    data: { ...body, ...(body.date ? { date: new Date(body.date) } : {}) },
  });
  return ok(record);
});

export const DELETE = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const existing = await db.mileageRecord.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) throw errors.notFound("Mileage record");
  await db.mileageRecord.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
});
