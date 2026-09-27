import { db } from "@/lib/db";
import { withAuth, errors, ok, assertSameOrigin } from "@/lib/api";

type Params = { id: string };

/** Revoke a session (sign out a device). Cannot revoke via this route the... actually can — it just ends that session. */
export const DELETE = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const session = await db.session.findFirst({ where: { id: params.id, userId: user.id } });
  if (!session) throw errors.notFound("Session");
  await db.session.delete({ where: { id: session.id } });
  return ok({ revoked: true });
});
