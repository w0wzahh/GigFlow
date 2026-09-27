import { db } from "@/lib/db";
import { withAuth, errors, ok, assertSameOrigin } from "@/lib/api";
import { getAdapter } from "@/lib/integrations/registry";

type Params = { id: string };

export const DELETE = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const conn = await db.platformConnection.findFirst({
    where: { id: params.id, userId: user.id },
    include: { platform: true },
  });
  if (!conn) throw errors.notFound("Connection");
  const adapter = getAdapter(conn.platform.adapterKey);
  if (adapter) {
    try {
      await adapter.disconnect({ userId: user.id, connectionId: conn.id });
    } catch { /* disconnect anyway */ }
  }
  await db.platformConnection.delete({ where: { id: conn.id } });
  return ok({ disconnected: true });
});
