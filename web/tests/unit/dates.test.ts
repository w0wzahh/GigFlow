import { describe, it, expect } from "vitest";
import { periodRange, previousRange, zonedTimeToUtc } from "@/lib/dates";

describe("periodRange", () => {
  it("today returns a 24h span", () => {
    const r = periodRange("today", "UTC")!;
    expect(r.end.getTime() - r.start.getTime()).toBe(86399999);
  });
  it("week spans 7 days starting Monday", () => {
    const r = periodRange("week", "UTC")!;
    const days = (r.end.getTime() - r.start.getTime()) / 86400000;
    expect(days).toBeCloseTo(7, 0);
    // Monday in UTC
    expect(r.start.getUTCDay()).toBe(1);
  });
  it("month covers a calendar month", () => {
    const r = periodRange("month", "UTC")!;
    expect(r.start.getUTCDate()).toBe(1);
  });
  it("custom range parses ISO dates", () => {
    const r = periodRange("custom", "UTC", { start: "2026-09-01", end: "2026-09-10" })!;
    expect(r.start.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(r.end.toISOString().slice(0, 10)).toBe("2026-09-10");
  });
  it("returns null for invalid custom ranges and 'all'", () => {
    expect(periodRange("custom", "UTC", {})).toBeNull();
    expect(periodRange("all", "UTC")).toBeNull();
  });
});

describe("previousRange", () => {
  it("produces an equal-length preceding window", () => {
    const r = { start: new Date("2026-09-08T00:00:00Z"), end: new Date("2026-09-14T23:59:59.999Z") };
    const p = previousRange(r);
    expect(p.end.getTime()).toBe(r.start.getTime() - 1);
    expect(p.end.getTime() - p.start.getTime()).toBe(r.end.getTime() - r.start.getTime());
  });
});

describe("zonedTimeToUtc", () => {
  it("converts wall time in a zone to UTC", () => {
    // Midnight in Chicago (UTC-5 in Sept, CDT)
    const d = zonedTimeToUtc(2026, 9, 1, 0, 0, 0, "America/Chicago");
    expect(d.toISOString()).toBe("2026-09-01T05:00:00.000Z");
  });
});
