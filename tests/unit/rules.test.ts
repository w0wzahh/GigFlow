import { describe, it, expect } from "vitest";
import {
  computeOfferMetrics, evaluateOffer, evaluateCondition,
  type Rule, type RuleCondition,
} from "@/lib/rules/engine";

const baseRule = (conditions: RuleCondition[], label = "Good Offer"): Rule => ({
  id: "r1", name: "test", enabled: true, priority: 0,
  conditions, action: { label },
});

describe("computeOfferMetrics", () => {
  it("computes per-hour and per-km rates", () => {
    const m = computeOfferMetrics({
      payoutCents: 1500, estDistanceKm: 10, estDurationMin: 30,
    });
    expect(m.earningsPerHourCents).toBe(3000); // $15 in 30min = $30/h
    expect(m.earningsPerKmCents).toBe(150); // $1.50/km
    expect(m.profitCents).toBe(1500 - 350); // minus est. expenses
  });

  it("includes tip in rate calculations", () => {
    const m = computeOfferMetrics({
      payoutCents: 1000, tipCents: 500, estDistanceKm: 10, estDurationMin: 30,
    });
    expect(m.earningsPerHourCents).toBe(3000);
  });

  it("returns null rates when distance/duration are zero", () => {
    const m = computeOfferMetrics({ payoutCents: 1000, estDistanceKm: 0, estDurationMin: 0 });
    expect(m.earningsPerHourCents).toBeNull();
    expect(m.earningsPerKmCents).toBeNull();
  });
});

describe("evaluateCondition", () => {
  const metrics = computeOfferMetrics({
    payoutCents: 1500, estDistanceKm: 10, estDurationMin: 30, platformName: "Uber",
  });
  it("evaluates numeric comparisons", () => {
    expect(evaluateCondition(metrics, { field: "earnings_per_hour_cents", op: "gte", value: 2500 })).toBe(true);
    expect(evaluateCondition(metrics, { field: "earnings_per_hour_cents", op: "lt", value: 2500 })).toBe(false);
    expect(evaluateCondition(metrics, { field: "est_distance_km", op: "lte", value: 12 })).toBe(true);
  });
  it("evaluates string comparisons (platform)", () => {
    expect(evaluateCondition(metrics, { field: "platform_name", op: "eq", value: "uber" })).toBe(true);
    expect(evaluateCondition(metrics, { field: "platform_name", op: "contains", value: "ube" })).toBe(true);
    expect(evaluateCondition(metrics, { field: "platform_name", op: "eq", value: "lyft" })).toBe(false);
  });
  it("fails closed when a metric is unavailable", () => {
    const m = computeOfferMetrics({ payoutCents: 100, estDistanceKm: 0, estDurationMin: 0 });
    expect(evaluateCondition(m, { field: "earnings_per_km_cents", op: "gte", value: 0 })).toBe(false);
  });
});

describe("evaluateOffer", () => {
  const metrics = computeOfferMetrics({
    payoutCents: 1500, estDistanceKm: 10, estDurationMin: 30,
  });
  it("labels offers when all conditions pass", () => {
    const rules = [
      baseRule([
        { field: "earnings_per_hour_cents", op: "gte", value: 2500 },
        { field: "earnings_per_km_cents", op: "gte", value: 100 },
      ]),
    ];
    const r = evaluateOffer(metrics, rules);
    expect(r.matched).toBe(true);
    expect(r.labels).toContain("Good Offer");
  });
  it("does not match when any condition fails (AND)", () => {
    const rules = [
      baseRule([
        { field: "earnings_per_hour_cents", op: "gte", value: 2500 },
        { field: "payout_cents", op: "gte", value: 5000 },
      ]),
    ];
    expect(evaluateOffer(metrics, rules).matched).toBe(false);
  });
  it("skips disabled rules and respects priority ordering", () => {
    const rules: Rule[] = [
      { ...baseRule([{ field: "payout_cents", op: "gte", value: 0 }], "Disabled"), enabled: false, priority: 0, id: "a", name: "a" },
      { ...baseRule([{ field: "payout_cents", op: "gte", value: 0 }], "First"), priority: 1, id: "b", name: "b" },
      { ...baseRule([{ field: "payout_cents", op: "gte", value: 0 }], "Second"), priority: 2, id: "c", name: "c" },
    ];
    const r = evaluateOffer(metrics, rules);
    expect(r.labels).toEqual(["First", "Second"]);
    expect(r.matchedRules).toEqual(["b", "c"]);
  });
});
