import { z } from "zod";
import { db } from "@/lib/db";
import { withErrors, ok } from "@/lib/api";
import { getMobileUser } from "@/lib/mobile";
import { computeOfferMetrics, evaluateOffer, parseRuleRow } from "@/lib/rules/engine";

// Payload sent by the Android companion (GigFlowApi.kt). Metric units match
// the DB: cents, kilometers, minutes.
const offerPush = z.object({
  platformKey: z.string().max(60).optional(),
  payoutCents: z.number().int().nonnegative().max(1_000_000),
  tipCents: z.number().int().nonnegative().max(1_000_000).optional(),
  estDistanceKm: z.number().nonnegative().max(2000).optional(),
  estDurationMin: z.number().nonnegative().max(1440).optional(),
  perMileCents: z.number().int().optional(),
  perHourCents: z.number().int().optional(),
  verdict: z.enum(["GOOD", "MEH", "BAD"]).optional(),
  action: z.enum(["shown", "auto_accept", "auto_decline", "manual_accept", "manual_decline"]).default("shown"),
  seenAt: z.number().int().positive().optional(), // epoch ms from device
});

/**
 * POST /api/mobile/offers — companion-app push endpoint.
 *
 * Auth: `Authorization: Bearer <mobile token>` (generated in
 * Settings → Security). The token is looked up by SHA-256 hash; plaintext
 * tokens are never stored server-side.
 *
 * Rate limit: 300 pushes / 5 min / IP — a busy shift produces far fewer.
 */
export const POST = withErrors(async (req) => {
  const user = await getMobileUser(req);

  const body = offerPush.parse(await req.json());

  const platform = body.platformKey
    ? await db.platform.findUnique({
        where: { key: body.platformKey },
        select: { id: true, key: true, name: true },
      })
    : null;

  const metrics = computeOfferMetrics({
    platformKey: platform?.key,
    platformName: platform?.name,
    payoutCents: body.payoutCents,
    tipCents: body.tipCents ?? 0,
    estDistanceKm: body.estDistanceKm ?? 0,
    estDurationMin: body.estDurationMin ?? 0,
  });
  const rules = (await db.rule.findMany({ where: { userId: user.id, enabled: true } })).map(parseRuleRow);
  const evalResult = evaluateOffer(metrics, rules);

  const status =
    body.action === "auto_accept" || body.action === "manual_accept"
      ? "ACCEPTED"
      : body.action === "auto_decline" || body.action === "manual_decline"
        ? "DECLINED"
        : "PENDING";

  const offer = await db.offer.create({
    data: {
      userId: user.id,
      platformId: platform?.id ?? null,
      payoutCents: metrics.payoutCents,
      tipCents: body.tipCents ?? 0,
      estDistanceKm: metrics.estDistanceKm,
      estDurationMin: metrics.estDurationMin,
      estExpensesCents: metrics.estExpensesCents,
      evalLabel: evalResult.labels[0] ?? null,
      evalReasons: JSON.stringify(evalResult.matchedRules),
      status,
      source: "COMPANION",
      receivedAt: body.seenAt ? new Date(body.seenAt) : undefined,
    },
  });

  return ok({ id: offer.id, status, evalLabel: offer.evalLabel });
});
