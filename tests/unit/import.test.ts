import { describe, it, expect } from "vitest";
import { parseStatement, parseCsv, parseMoneyCents, ParseError } from "@/lib/import";
import { parseReceiptBody, platformForSender } from "@/lib/integrations/gmail";

describe("parseCsv", () => {
  it("handles quoted fields, commas, and CRLF", () => {
    const rows = parseCsv('a,b\r\n"x, y",2\r\n');
    expect(rows).toEqual([["a", "b"], ["x, y", "2"]]);
  });
  it("handles escaped quotes and strips BOM", () => {
    const rows = parseCsv('﻿a\n"say ""hi""",tail\n');
    expect(rows[1][0]).toBe('say "hi"');
  });
});

describe("parseMoneyCents", () => {
  it("parses currency formats", () => {
    expect(parseMoneyCents("$1,234.56")).toBe(123456);
    expect(parseMoneyCents("12.34")).toBe(1234);
    expect(parseMoneyCents("($4.00)")).toBe(-400);
    expect(parseMoneyCents("-$4.00")).toBe(-400);
    expect(parseMoneyCents("abc")).toBeNull();
  });
});

describe("parseStatement", () => {
  it("detects date/amount/tip/ref columns and dedupes within a file", () => {
    const csv = [
      "Trip ID,Date,Your earnings,Tips",
      "t-1,09/01/2026,20.00,3.00",
      "t-2,09/02/2026,$15.50,1.00",
      "t-1,09/01/2026,20.00,3.00", // duplicate trip id → distinct importKey via occurrence suffix
    ].join("\n");
    const r = parseStatement(csv, "uber");
    expect(r.rows).toHaveLength(3);
    expect(new Set(r.rows.map((x) => x.importKey)).size).toBe(3);
    // "Your earnings" already includes tips → base = total - tip
    expect(r.rows[0].amountCents).toBe(1700);
    expect(r.rows[0].tipCents).toBe(300);
  });

  it("converts miles to km based on the header", () => {
    const csv = "Date,Total pay,Distance miles\n2026-09-01,10.00,10\n";
    const r = parseStatement(csv, "other");
    expect(r.rows[0].distanceKm).toBeCloseTo(16.1, 1);
  });

  it("rejects files without a detectable header row", () => {
    expect(() => parseStatement("foo,bar\nbaz,qux", "other")).toThrow(ParseError);
  });
});

describe("gmail receipt parsing", () => {
  it("maps known senders to platform keys", () => {
    expect(platformForSender("Uber Receipts <noreply@uber.com>")).toBe("uber");
    expect(platformForSender("Lyft <no-reply@lyftmail.com>")).toBe("lyft");
    expect(platformForSender("random@example.com")).toBeNull();
  });

  it("extracts labeled totals and tips", () => {
    const body = "Your earnings $24.50. Tip $3.00. Thanks for driving.";
    const r = parseReceiptBody(body)!;
    expect(r.amountCents).toBe(2450);
    expect(r.tipCents).toBe(300);
  });

  it("strips HTML and falls back to the largest figure", () => {
    const html = "<style>x{color:red}</style><p>Fare <b>$8.20</b></p><p>Total <b>$31.40</b></p>";
    const r = parseReceiptBody(html)!;
    expect(r.amountCents).toBe(3140);
  });

  it("returns null when no money is present", () => {
    expect(parseReceiptBody("Thanks for riding with us")).toBeNull();
  });
});
