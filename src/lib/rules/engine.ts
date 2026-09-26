/**
 * Smart Rules engine.
 *
 * Rules are data, not code: each rule stores a JSON array of conditions and a
 * JSON action. Conditions are evaluated against an offer's computed metrics.
 * All conditions must pass (AND semantics).
 */

export type OfferMetrics = {
  platformKey?: string | null;
  platformName?: string | null;
  payoutCents: number;
  tipCents: number;
  estDistanceKm: number;
  estDurationMin: number;
  estExpensesCents: number;
  earningsPerHourCents: number | null;
  earningsPerKmCents: number | null;
  profitCents: number;
};

export const RULE_FIELDS = [
  "payout_cents",
  "earnings_per_hour_cents",
  "earnings_per_km_cents",
  "est_distance_km",
  "est_duration_min",
  "profit_cents",
  "platform_name",
] as const;

export type RuleField = (typeof RULE_FIELDS)[number];

export const RULE_OPS = ["gte", "lte", "gt", "lt", "eq", "neq", "contains"] as const;
export type RuleOp = (typeof RULE_OPS)[number];

export type RuleCondition = {
  field: RuleField;
  op: RuleOp;
  value: number | string;
};

export type RuleAction = {
  label: string; // e.g. "Good Offer"
  notify?: boolean;
};

export type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: RuleCondition[];
  action: RuleAction;
};

export function computeOfferMetrics(input: {
  platformKey?: string | null;
  platformName?: string | null;
  payoutCents: number;
  tipCents?: number;
  estDistanceKm: number;
  estDurationMin: number;
  costPerKmCents?: number; // user cost model; defaults below
}): OfferMetrics {
  const tip = input.tipCents ?? 0;
  const costPerKm = input.costPerKmCents ?? 35; // ~$0.56/mi IRS-ish default
  const estExpenses = Math.round(input.estDistanceKm * costPerKm);
  const total = input.payoutCents + tip;
  return {
    platformKey: input.platformKey ?? null,
    platformName: input.platformName ?? null,
    payoutCents: input.payoutCents,
    tipCents: tip,
    estDistanceKm: input.estDistanceKm,
    estDurationMin: input.estDurationMin,
    estExpensesCents: estExpenses,
    earningsPerHourCents:
      input.estDurationMin > 0 ? Math.round((total / input.estDurationMin) * 60) : null,
    earningsPerKmCents:
      input.estDistanceKm > 0 ? Math.round(total / input.estDistanceKm) : null,
    profitCents: total - estExpenses,
  };
}

function compare(actual: number | string | null, op: RuleOp, expected: number | string): boolean {
  if (actual == null) return false;
  if (typeof actual === "string" || typeof expected === "string") {
    const a = String(actual).toLowerCase();
    const e = String(expected).toLowerCase();
    switch (op) {
      case "eq": return a === e;
      case "neq": return a !== e;
      case "contains": return a.includes(e);
      default: return false;
    }
  }
  switch (op) {
    case "gte": return actual >= expected;
    case "lte": return actual <= expected;
    case "gt": return actual > expected;
    case "lt": return actual < expected;
    case "eq": return actual === expected;
    case "neq": return actual !== expected;
    default: return false;
  }
}

function conditionValue(metrics: OfferMetrics, field: RuleField): number | string | null {
  switch (field) {
    case "payout_cents": return metrics.payoutCents + metrics.tipCents;
    case "earnings_per_hour_cents": return metrics.earningsPerHourCents;
    case "earnings_per_km_cents": return metrics.earningsPerKmCents;
    case "est_distance_km": return metrics.estDistanceKm;
    case "est_duration_min": return metrics.estDurationMin;
    case "profit_cents": return metrics.profitCents;
    case "platform_name": return metrics.platformName ?? null;
  }
}

export function evaluateCondition(metrics: OfferMetrics, c: RuleCondition): boolean {
  return compare(conditionValue(metrics, c.field), c.op, c.value);
}

export type EvaluationResult = {
  matched: boolean;
  labels: string[];
  matchedRules: string[]; // rule names
  failedConditions: { rule: string; condition: RuleCondition }[];
};

/**
 * Evaluate enabled rules in priority order. Returns the union of labels from
 * every rule whose conditions all pass.
 */
export function evaluateOffer(metrics: OfferMetrics, rules: Rule[]): EvaluationResult {
  const sorted = [...rules].filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);
  const labels: string[] = [];
  const matchedRules: string[] = [];
  const failedConditions: EvaluationResult["failedConditions"] = [];
  for (const rule of sorted) {
    const failures = rule.conditions.filter((c) => !evaluateCondition(metrics, c));
    if (failures.length === 0) {
      if (!labels.includes(rule.action.label)) labels.push(rule.action.label);
      matchedRules.push(rule.name);
    } else {
      for (const c of failures) failedConditions.push({ rule: rule.name, condition: c });
    }
  }
  return { matched: labels.length > 0, labels, matchedRules, failedConditions };
}

/** Serialize/deserialize helpers for the Rule table's JSON columns. */
export function parseRuleRow(row: {
  id: string; name: string; enabled: boolean; priority: number;
  conditionsJson: string; actionJson: string;
}): Rule {
  let conditions: RuleCondition[] = [];
  let action: RuleAction = { label: "Labeled" };
  try { conditions = JSON.parse(row.conditionsJson); } catch { /* keep default */ }
  try { action = { ...action, ...JSON.parse(row.actionJson) }; } catch { /* keep default */ }
  return { id: row.id, name: row.name, enabled: row.enabled, priority: row.priority, conditions, action };
}
