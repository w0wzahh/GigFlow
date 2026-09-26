import { db } from "@/lib/db";
import { withAuth, parseBody, errors, ok, assertSameOrigin } from "@/lib/api";
import { vehicleSchema } from "@/lib/schemas";

type Params = { id: string };

export const PATCH = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const existing = await db.vehicle.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) throw errors.notFound("Vehicle");
  const body = await parseBody(req, vehicleSchema.partial());
  const vehicle = await db.$transaction(async (tx) => {
    const v = await tx.vehicle.update({ where: { id: existing.id }, data: body });
    if (body.isDefault) {
      await tx.vehicle.updateMany({
        where: { userId: user.id, id: { not: v.id } },
        data: { isDefault: false },
      });
    }
    return v;
  });
  return ok(vehicle);
});

export const DELETE = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const existing = await db.vehicle.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) throw errors.notFound("Vehicle");
  await db.vehicle.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
});
