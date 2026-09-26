import { db } from "@/lib/db";
import { withAuth, parseBody, errors, ok, assertSameOrigin } from "@/lib/api";
import { scheduleSchema } from "@/lib/schemas";

type Params = { id: string };

export const PATCH = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const existing = await db.scheduleEntry.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) throw errors.notFound("Schedule entry");
  const body = await parseBody(req, scheduleSchema.partial());
  const entry = await db.scheduleEntry.update({
    where: { id: existing.id },
    data: {
      ...body,
      date: body.date !== undefined ? (body.date ? new Date(body.date) : null) : undefined,
      platformIds: body.platformIds !== undefined ? JSON.stringify(body.platformIds ?? []) : undefined,
    },
  });
  return ok(entry);
});

export const DELETE = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const existing = await db.scheduleEntry.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) throw errors.notFound("Schedule entry");
  await db.scheduleEntry.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
});
