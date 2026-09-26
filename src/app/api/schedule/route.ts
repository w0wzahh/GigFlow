import { db } from "@/lib/db";
import { withAuth, parseBody, ok, assertSameOrigin } from "@/lib/api";
import { scheduleSchema } from "@/lib/schemas";

export const GET = withAuth(async (_req, { user }) => {
  const entries = await db.scheduleEntry.findMany({
    where: { userId: user.id },
    orderBy: [{ dayOfWeek: "asc" }, { startMin: "asc" }],
  });
  const platforms = await db.platform.findMany({
    select: { id: true, name: true, color: true },
  });
  const byId = new Map(platforms.map((p) => [p.id, p]));
  return ok(
    entries.map((e) => ({
      ...e,
      platformIds: safeParse(e.platformIds),
      platforms: safeParse(e.platformIds).map((id) => byId.get(id)).filter(Boolean),
    })),
  );
});

export const POST = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const body = await parseBody(req, scheduleSchema);
  const entry = await db.scheduleEntry.create({
    data: {
      userId: user.id,
      title: body.title ?? null,
      dayOfWeek: body.dayOfWeek ?? null,
      date: body.date ? new Date(body.date) : null,
      startMin: body.startMin,
      endMin: body.endMin,
      zone: body.zone ?? null,
      platformIds: body.platformIds ? JSON.stringify(body.platformIds) : null,
      targetCents: body.targetCents ?? null,
    },
  });
  return ok(entry);
});

function safeParse(s: string | null): string[] {
  if (!s) return [];
  try { return JSON.parse(s); } catch { return []; }
}
