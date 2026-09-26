import { db } from "@/lib/db";
import { withAuth, parseBody, errors, ok, assertSameOrigin } from "@/lib/api";
import { z } from "zod";

type Params = { id: string };

const patchSchema = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "DECLINED", "EXPIRED"]).optional(),
});

export const PATCH = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const existing = await db.offer.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) throw errors.notFound("Offer");
  const body = await parseBody(req, patchSchema);
  const offer = await db.offer.update({ where: { id: existing.id }, data: body });
  return ok(offer);
});

export const DELETE = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const existing = await db.offer.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) throw errors.notFound("Offer");
  await db.offer.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
});
