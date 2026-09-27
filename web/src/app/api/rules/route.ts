import { db } from "@/lib/db";
import { withAuth, parseBody, ok, assertSameOrigin } from "@/lib/api";
import { ruleSchema } from "@/lib/schemas";
import { parseRuleRow, computeOfferMetrics, evaluateOffer } from "@/lib/rules/engine";
import { z } from "zod";
import { offerSchema } from "@/lib/schemas";

export const GET = withAuth(async (_req, { user }) => {
  const rules = await db.rule.findMany({
    where: { userId: user.id },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  return ok(rules.map((r) => ({ ...r, parsed: parseRuleRow(r) })));
});

export const POST = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const body = await parseBody(req, ruleSchema);
  const rule = await db.rule.create({
    data: {
      userId: user.id,
      name: body.name,
      enabled: body.enabled,
      priority: body.priority,
      conditionsJson: JSON.stringify(body.conditions),
      actionJson: JSON.stringify(body.action),
    },
  });
  return ok({ ...rule, parsed: parseRuleRow(rule) });
});

const evaluateSchema = z.object({ offer: offerSchema });

/** Dry-run: evaluate a hypothetical offer against the user's rules. */
export const PUT = withAuth(async (req, { user }) => {
  const { offer } = await parseBody(req, evaluateSchema);
  const platform = offer.platformId
    ? await db.platform.findUnique({ where: { id: offer.platformId } })
    : null;
  const metrics = computeOfferMetrics({
    platformKey: platform?.key,
    platformName: platform?.name,
    ...offer,
  });
  const rules = (await db.rule.findMany({ where: { userId: user.id } })).map(parseRuleRow);
  return ok({ metrics, evaluation: evaluateOffer(metrics, rules) });
});
