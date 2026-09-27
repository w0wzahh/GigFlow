import { db } from "@/lib/db";
import { withAuth, parseBody, errors, ok, assertSameOrigin } from "@/lib/api";
import { ruleSchema } from "@/lib/schemas";
import { parseRuleRow } from "@/lib/rules/engine";

type Params = { id: string };

export const PATCH = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const existing = await db.rule.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) throw errors.notFound("Rule");
  const body = await parseBody(req, ruleSchema.partial());
  const rule = await db.rule.update({
    where: { id: existing.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
      ...(body.conditions ? { conditionsJson: JSON.stringify(body.conditions) } : {}),
      ...(body.action ? { actionJson: JSON.stringify(body.action) } : {}),
    },
  });
  return ok({ ...rule, parsed: parseRuleRow(rule) });
});

export const DELETE = withAuth<Params>(async (req, { user, params }) => {
  assertSameOrigin(req);
  const existing = await db.rule.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) throw errors.notFound("Rule");
  await db.rule.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
});
