import { db } from "@/lib/db";
import { withAuth, parseBody, ok, assertSameOrigin } from "@/lib/api";
import { z } from "zod";

const schema = z.object({
  ids: z.array(z.string()).optional(), // omit = mark all read
});

export const POST = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const { ids } = await parseBody(req, schema);
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  return ok({ done: true });
});
