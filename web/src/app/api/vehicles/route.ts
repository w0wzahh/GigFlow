import { db } from "@/lib/db";
import { withAuth, parseBody, errors, ok, assertSameOrigin } from "@/lib/api";
import { vehicleSchema } from "@/lib/schemas";

export const GET = withAuth(async (_req, { user }) => {
  const vehicles = await db.vehicle.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return ok(vehicles);
});

export const POST = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const body = await parseBody(req, vehicleSchema);
  const vehicle = await db.$transaction(async (tx) => {
    const count = await tx.vehicle.count({ where: { userId: user.id } });
    const v = await tx.vehicle.create({
      data: { ...body, userId: user.id, isDefault: body.isDefault ?? count === 0 },
    });
    if (v.isDefault) {
      await tx.vehicle.updateMany({
        where: { userId: user.id, id: { not: v.id } },
        data: { isDefault: false },
      });
    }
    return v;
  });
  return ok(vehicle);
});

export async function assertVehicleOwnership(vehicleId: string, userId: string) {
  const v = await db.vehicle.findFirst({ where: { id: vehicleId, userId } });
  if (!v) throw errors.notFound("Vehicle");
  return v;
}
