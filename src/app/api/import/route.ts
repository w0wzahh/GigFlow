import { db } from "@/lib/db";
import { withAuth, ok, errors, assertSameOrigin } from "@/lib/api";
import { parseStatement, ParseError } from "@/lib/import";
import { rateLimit } from "@/lib/ratelimit";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB of CSV is ~50k trips

/**
 * POST /api/import — multipart form: { file: CSV, platformId?: string }
 * Parses a platform earnings statement and creates Earning rows with
 * source="IMPORT". Idempotent via importKey dedupe.
 */
export const POST = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const rl = rateLimit(`import:${user.id}`, 12, 60_000);
  if (!rl.ok) throw errors.tooMany(rl.retryAfterSec);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const platformId = form?.get("platformId");
  if (!(file instanceof File)) throw errors.badRequest("Attach a CSV file.");
  if (file.size > MAX_BYTES) throw errors.badRequest("File too large (max 4 MB).");
  if (!/csv|text|vnd|octet/.test(file.type) && !file.name.toLowerCase().endsWith(".csv")) {
    throw errors.badRequest("That doesn't look like a CSV file.");
  }

  let platformKey = "other";
  let resolvedPlatformId: string | null = null;
  if (typeof platformId === "string" && platformId) {
    const platform = await db.platform.findUnique({ where: { id: platformId } });
    if (!platform) throw errors.badRequest("Unknown platform.");
    platformKey = platform.key;
    resolvedPlatformId = platform.id;
    // Adding to a platform implies tracking it.
    await db.platformConnection.upsert({
      where: { userId_platformId: { userId: user.id, platformId: platform.id } },
      update: {},
      create: { userId: user.id, platformId: platform.id, status: "MANUAL" },
    });
  }

  const text = await file.text();
  let result;
  try {
    result = parseStatement(text, platformKey);
  } catch (e) {
    throw errors.badRequest(e instanceof ParseError ? e.message : "Could not parse that file.");
  }

  const existing = await db.earning.findMany({
    where: { userId: user.id, importKey: { in: result.rows.map((r) => r.importKey) } },
    select: { importKey: true },
  });
  const seen = new Set(existing.map((e) => e.importKey));
  const fresh = result.rows.filter((r) => !seen.has(r.importKey));

  if (fresh.length) {
    await db.earning.createMany({
      data: fresh.map((r) => ({
        userId: user.id,
        platformId: resolvedPlatformId,
        category: r.category,
        amountCents: r.amountCents,
        tipCents: r.tipCents,
        bonusCents: r.bonusCents,
        earnedAt: r.earnedAt,
        hours: r.hours,
        distanceKm: r.distanceKm,
        notes: r.notes,
        importKey: r.importKey,
        source: "IMPORT",
      })),
    });
  }

  return ok({
    imported: fresh.length,
    duplicates: result.rows.length - fresh.length,
    skippedRows: result.skipped,
    mapping: result.mapping,
  });
});
