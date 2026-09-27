import { describe, it, expect } from "vitest";
import { kmToUnit, unitToKm, formatMoney, formatDistance } from "@/lib/units";

describe("distance units", () => {
  it("converts km to miles", () => {
    expect(kmToUnit(1.609344, "MI")).toBeCloseTo(1);
    expect(kmToUnit(10, "KM")).toBe(10);
  });
  it("round-trips", () => {
    expect(unitToKm(kmToUnit(42, "MI"), "MI")).toBeCloseTo(42);
  });
});

describe("formatMoney", () => {
  it("formats cents", () => {
    expect(formatMoney(14240, "USD")).toBe("$142.40");
    expect(formatMoney(0, "USD")).toBe("$0.00");
    expect(formatMoney(-500, "USD")).toContain("5.00");
  });
});

describe("formatDistance", () => {
  it("formats with unit labels", () => {
    expect(formatDistance(10, "KM")).toBe("10.0 km");
    expect(formatDistance(16.09344, "MI")).toBe("10.0 mi");
  });
});
