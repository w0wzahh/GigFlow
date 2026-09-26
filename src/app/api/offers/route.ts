import { db } from "@/lib/db";
import { withAuth, parseBody, ok, assertSameOrigin } from "@/lib/api";
import { offerSchema } from "@/lib/schemas";
import { computeOfferMetrics, evaluateOffer, parseRuleRow } from "@/lib/rules/engine";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const offers = await db.offer.findMany({
    where: { userId: user.id, ...(status ? { status } : {}) },
    include: { platform: { select: { name: true, color: true, key: true } } },
    orderBy: { receivedAt: "desc" },
    take: 100,
  });
  return ok(
    offers.map((o) => ({
      ...o,
      metrics: computeOfferMetrics({
        platformName: o.platform?.name,
        payoutCents: o.payoutCents,
        tipCents: o.tipCents,
        estDistanceKm: o.estDistanceKm,
        estDurationMin: o.estDurationMin,
      }),
    })),
  );
});

/**
 * Create an offer record and immediately evaluate it against the user's
 * enabled rules. GigFlow only *evaluates* — it never accepts or declines on
 * a third-party platform.
 */
export const POST = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const body = await parseBody(req, offerSchema);
  const platform = body.platformId
    ? await db.platform.findUnique({ where: { id: body.platformId } })
    : null;
  const metrics = computeOfferMetrics({
    platformKey: platform?.key,
    platformName: platform?.name,
    ...body,
  });
  const rules = (await db.rule.findMany({ where: { userId: user.id, enabled: true } })).map(parseRuleRow);
  const evalResult = evaluateOffer(metrics, rules);

  const offer = await db.offer.create({
    data: {
      ...body,
      userId: user.id,
      estExpensesCents: metrics.estExpensesCents,
      evalLabel: evalResult.labels[0] ?? null,
      evalReasons: JSON.stringify(evalResult.matchedRules),
      status: "PENDING",
    },
  });
  return ok({ ...offer, metrics, evaluation: evalResult });
});
