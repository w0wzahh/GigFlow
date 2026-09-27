import { z } from "zod";
import { Prisma } from "@prisma/client";
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

/**
 * P2002 = unique violation on (userId, importKey) — a concurrent retry of the
 * same clientId raced us. The row already exists, so treat it as deduped.
 */
function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

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
    try {
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
    } catch (e) {
      if (idemKey && isUniqueViolation(e)) return { deduped: true };
      throw e;
    }
  }

  if (body.type === "expense") {
    if (idemKey) {
      const dup = await db.expense.findFirst({ where: { userId, importKey: idemKey } });
      if (dup) return { id: dup.id, deduped: true };
    }
    try {
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
    } catch (e) {
      if (idemKey && isUniqueViolation(e)) return { deduped: true };
      throw e;
    }
  }

  if (idemKey) {
    const dup = await db.mileageRecord.findFirst({ where: { userId, importKey: idemKey } });
    if (dup) return { id: dup.id, deduped: true };
  }
  try {
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
  } catch (e) {
    if (idemKey && isUniqueViolation(e)) return { deduped: true };
    throw e;
  }
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

const refSchema = z.object({
  type: z.enum(["earning", "expense", "mileage"]),
  clientId: z.string().min(8).max(80),
});

const patchSchema = refSchema.extend({
  amountCents: z.number().int().min(-1_000_000).max(1_000_000).optional(),
  tipCents: z.number().int().nonnegative().max(1_000_000).optional(),
  hours: z.number().nonnegative().max(24).optional(),
  distanceKm: z.number().positive().max(2000).optional(),
  notes: z.string().max(500).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  startLocation: z.string().max(200).nullable().optional(),
  endLocation: z.string().max(200).nullable().optional(),
});

/**
 * PATCH — update a previously-pushed record in place, keyed by
 * `companion:<clientId>`.
 */
export const PATCH = withErrors(async (req) => {
  const user = await getMobileUser(req);
  const body = patchSchema.parse(await req.json());
  const key = `companion:${body.clientId}`;

  if (body.type === "earning") {
    const existing = await db.earning.findFirst({ where: { userId: user.id, importKey: key } });
    if (!existing) throw errors.notFound("Record");
    await db.earning.update({
      where: { id: existing.id },
      data: {
        ...(body.amountCents !== undefined ? { amountCents: body.amountCents } : {}),
        ...(body.tipCents !== undefined ? { tipCents: body.tipCents } : {}),
        ...(body.hours !== undefined ? { hours: body.hours } : {}),
        ...(body.distanceKm !== undefined ? { distanceKm: body.distanceKm } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });
    return ok({ updated: true });
  }
  if (body.type === "expense") {
    const existing = await db.expense.findFirst({ where: { userId: user.id, importKey: key } });
    if (!existing) throw errors.notFound("Record");
    await db.expense.update({
      where: { id: existing.id },
      data: {
        ...(body.amountCents !== undefined ? { amountCents: body.amountCents } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
      },
    });
    return ok({ updated: true });
  }
  const existing = await db.mileageRecord.findFirst({ where: { userId: user.id, importKey: key } });
  if (!existing) throw errors.notFound("Record");
  await db.mileageRecord.update({
    where: { id: existing.id },
    data: {
      ...(body.distanceKm !== undefined ? { distanceKm: body.distanceKm } : {}),
      ...(body.startLocation !== undefined ? { startLocation: body.startLocation } : {}),
      ...(body.endLocation !== undefined ? { endLocation: body.endLocation } : {}),
    },
  });
  return ok({ updated: true });
});

/** DELETE — remove a pushed record by `companion:<clientId>`. */
export const DELETE = withErrors(async (req) => {
  const user = await getMobileUser(req);
  const body = refSchema.parse(await req.json());
  const key = `companion:${body.clientId}`;

  const deleted =
    body.type === "earning"
      ? await db.earning.deleteMany({ where: { userId: user.id, importKey: key } })
      : body.type === "expense"
        ? await db.expense.deleteMany({ where: { userId: user.id, importKey: key } })
        : await db.mileageRecord.deleteMany({ where: { userId: user.id, importKey: key } });

  return ok({ deleted: deleted.count });
});
