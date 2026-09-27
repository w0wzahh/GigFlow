import { z } from "zod";
import { db } from "@/lib/db";
import { withErrors, ok, errors } from "@/lib/api";
import { getMobileUser } from "@/lib/mobile";

const record = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("earning"),
    clientId: z.string().max(80).optional(),
    platformKey: z.string().max(60).optional(),
    category: z.enum(["TRIP", "DELIVERY", "TIP", "BONUS", "ADJUSTMENT", "QUEST", "OTHER"]).default("OTHER"),
    amountCents: z.number().int().min(-1_000_000).max(1_000_000),
    tipCents: z.number().int().nonnegative().max(1_000_000).optional(),
    hours: z.number().nonnegative().max(24).optional(),
    distanceKm: z.number().nonnegative().max(2000).optional(),
    notes: z.string().max(500).optional(),
    earnedAt: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal("expense"),
    clientId: z.string().max(80).optional(),
    category: z.enum(["FUEL", "CHARGING", "MAINTENANCE", "INSURANCE", "PARKING", "TOLLS", "CAR_PAYMENT", "LEASE", "PHONE", "OTHER"]).default("OTHER"),
    amountCents: z.number().int().positive().max(1_000_000),
    description: z.string().max(500).optional(),
    occurredAt: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal("mileage"),
    clientId: z.string().max(80).optional(),
    distanceKm: z.number().positive().max(2000),
    purpose: z.enum(["WORK", "PERSONAL", "OTHER"]).default("WORK"),
    startLocation: z.string().max(200).optional(),
    endLocation: z.string().max(200).optional(),
    date: z.number().int().positive().optional(),
  }),
]);

type RecordBody = z.infer<typeof record>;

async function createRecord(userId: string, body: RecordBody): Promise<{ id?: string; deduped: boolean }> {
  const idemKey = body.clientId ? `companion:${body.clientId}` : null;

  if (body.type === "earning") {
    if (idemKey) {
      const dup = await db.earning.findFirst({ where: { userId, importKey: idemKey } });
      if (dup) return { id: dup.id, deduped: true };
    }
    const platform = body.platformKey
      ? await db.platform.findUnique({ where: { key: body.platformKey }, select: { id: true } })
      : null;
    const row = await db.earning.create({
      data: {
        userId,
        platformId: platform?.id ?? null,
        category: body.category,
        amountCents: body.amountCents,
        tipCents: body.tipCents ?? 0,
        hours: body.hours ?? 0,
        distanceKm: body.distanceKm ?? 0,
        notes: body.notes ?? null,
        earnedAt: body.earnedAt ? new Date(body.earnedAt) : new Date(),
        importKey: idemKey,
        source: "COMPANION",
      },
    });
    return { id: row.id, deduped: false };
  }

  if (body.type === "expense") {
    if (idemKey) {
      const dup = await db.expense.findFirst({ where: { userId, importKey: idemKey } });
      if (dup) return { id: dup.id, deduped: true };
    }
    const row = await db.expense.create({
      data: {
        userId,
        category: body.category,
        amountCents: body.amountCents,
        description: body.description ?? null,
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
        importKey: idemKey,
        source: "COMPANION",
      },
    });
    return { id: row.id, deduped: false };
  }

  if (idemKey) {
    const dup = await db.mileageRecord.findFirst({ where: { userId, importKey: idemKey } });
    if (dup) return { id: dup.id, deduped: true };
  }
  const row = await db.mileageRecord.create({
    data: {
      userId,
      distanceKm: body.distanceKm,
      purpose: body.purpose,
      startLocation: body.startLocation ?? null,
      endLocation: body.endLocation ?? null,
      date: body.date ? new Date(body.date) : new Date(),
      importKey: idemKey,
      source: "COMPANION",
    },
  });
  return { id: row.id, deduped: false };
}

/** Single record push. */
export const POST = withErrors(async (req) => {
  const user = await getMobileUser(req);
  const body = record.parse(await req.json());
  return ok(await createRecord(user.id, body));
});

/** Batch push for offline-created records (max 200). */
export const PUT = withErrors(async (req) => {
  const user = await getMobileUser(req);
  const items = z.array(record).max(200).parse(await req.json());
  if (items.length === 0) throw errors.badRequest("Empty batch.");
  let created = 0;
  for (const item of items) {
    const res = await createRecord(user.id, item);
    if (!res.deduped) created++;
  }
  return ok({ created, total: items.length });
});
