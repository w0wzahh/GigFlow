import { z } from "zod";
import { db } from "@/lib/db";
import { withErrors, ok } from "@/lib/api";
import { getMobileUser } from "@/lib/mobile";

const entry = z.object({
  clientId: z.string().min(8).max(80),
  title: z.string().max(120).nullable().optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  date: z.number().int().positive().nullable().optional(),
  startMin: z.number().int().min(0).max(1439),
  endMin: z.number().int().min(0).max(1439),
  zone: z.string().max(120).nullable().optional(),
  targetCents: z.number().int().positive().max(10_000_000).optional(),
});

function entryData(body: z.infer<typeof entry>) {
  return {
    title: body.title ?? null,
    dayOfWeek: body.dayOfWeek ?? null,
    date: body.date ? new Date(body.date) : null,
    startMin: body.startMin,
    endMin: body.endMin,
    zone: body.zone ?? null,
    targetCents: body.targetCents ?? null,
  };
}

/** List all schedule entries (for pull-sync to the companion). */
export const GET = withErrors(async (req) => {
  const user = await getMobileUser(req);
  const entries = await db.scheduleEntry.findMany({
    where: { userId: user.id },
    orderBy: [{ dayOfWeek: "asc" }, { startMin: "asc" }],
  });
  return ok({
    entries: entries.map((e) => ({
      clientId: e.importKey?.startsWith("companion:") ? e.importKey.slice(10) : null,
      id: e.id,
      title: e.title,
      dayOfWeek: e.dayOfWeek,
      date: e.date?.getTime() ?? null,
      startMin: e.startMin,
      endMin: e.endMin,
      zone: e.zone,
      targetCents: e.targetCents,
    })),
  });
});

/** Create or update a schedule entry, idempotent on clientId. */
export const POST = withErrors(async (req) => {
  const user = await getMobileUser(req);
  const body = entry.parse(await req.json());
  const key = `companion:${body.clientId}`;

  const existing = await db.scheduleEntry.findFirst({
    where: { userId: user.id, importKey: key },
  });
  if (existing) {
    await db.scheduleEntry.update({
      where: { id: existing.id },
      data: entryData(body),
    });
    return ok({ id: existing.id, updated: true });
  }
  const row = await db.scheduleEntry.create({
    data: { userId: user.id, importKey: key, ...entryData(body) },
  });
  return ok({ id: row.id, updated: false });
});

/** Delete by clientId. */
export const DELETE = withErrors(async (req) => {
  const user = await getMobileUser(req);
  const body = z.object({ clientId: z.string().min(8).max(80) }).parse(await req.json());
  const deleted = await db.scheduleEntry.deleteMany({
    where: { userId: user.id, importKey: `companion:${body.clientId}` },
  });
  return ok({ deleted: deleted.count });
});
