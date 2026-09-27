import { db } from "@/lib/db";
import { withAuth, parseBody, errors, ok, assertSameOrigin } from "@/lib/api";
import { getAdapter } from "@/lib/integrations/registry";
import { notify } from "@/lib/notifications";
import { z } from "zod";

const connectSchema = z.object({
  platformId: z.string(),
});

/**
 * Connect a platform. For adapter-backed platforms this runs the adapter's
 * authenticate() flow; for manual platforms it records intent to track.
 */
export const POST = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const { platformId } = await parseBody(req, connectSchema);
  const platform = await db.platform.findUnique({ where: { id: platformId } });
  if (!platform) throw errors.notFound("Platform");
  if (platform.status === "COMING_SOON") {
    throw errors.badRequest(`${platform.name} integration is not available yet.`);
  }

  const connection = await db.platformConnection.upsert({
    where: { userId_platformId: { userId: user.id, platformId } },
    update: { status: "PENDING", lastError: null },
    create: { userId: user.id, platformId, status: "PENDING" },
  });

  const adapter = getAdapter(platform.adapterKey);
  if (adapter) {
    try {
      await adapter.authenticate({ userId: user.id, connectionId: connection.id });
      await db.platformConnection.update({
        where: { id: connection.id },
        data: { status: "CONNECTED" },
      });
    } catch (e) {
      await db.platformConnection.update({
        where: { id: connection.id },
        data: { status: "ERROR", lastError: e instanceof Error ? e.message : "Connection failed" },
      });
      await notify(user.id, "PLATFORM", `${platform.name} connection failed`, platform.statusNote ?? undefined);
      throw errors.badRequest(`Could not connect ${platform.name}.`);
    }
  } else {
    // No adapter — this is a manual-tracking platform.
    await db.platformConnection.update({
      where: { id: connection.id },
      data: { status: "MANUAL" },
    });
  }

  const fresh = await db.platformConnection.findUniqueOrThrow({
    where: { id: connection.id },
    include: { platform: true },
  });
  return ok(fresh);
});
