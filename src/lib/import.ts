import { createHash } from "node:crypto";

/**
 * Statement import pipeline.
 *
 * Gig platforms don't offer public driver APIs, but all of them let drivers
 * download earnings/payment exports (CSV). This module parses those exports —
 * plus any generic CSV with date + amount columns — into Earning rows.
 *
 * Idempotency: every parsed row gets a stable `importKey` (sha256 of platform +
 * source reference or canonical row content). Re-importing the same file is a
 * no-op; the API layer dedupes on `importKey`.
 */

export type ParsedEarning = {
  importKey: string;
  earnedAt: Date;
  amountCents: number;
  tipCents: number;
  bonusCents: number;
  distanceKm: number;
  hours: number;
  category: string;
  notes: string | null;
};

export type ParseResult = {
  rows: ParsedEarning[];
  skipped: number;
  headers: string[];
  mapping: { date: string; amount: string; tip?: string; bonus?: string; ref?: string };
};

export class ParseError extends Error {}

/* ---------------- CSV tokenizer (RFC 4180) ---------------- */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const push = () => { row.push(field); field = ""; };
  const endRow = () => { push(); rows.push(row); row = []; };

  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { push(); i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { endRow(); i++; continue; }
    field += c; i++;
  }
  if (field !== "" || row.length > 0) endRow();
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/* ---------------- Column detection ---------------- */

const DATE_HINTS = [
  /^date$/i, /trip date/i, /completed/i, /paid/i, /time/i, /date/i, /week/i, /day/i,
];
const AMOUNT_HINTS = [
  /your earnings/i, /driver pay/i, /net earnings/i, /driver earnings/i,
  /total (earnings|pay|payout|fare)/i, /^total$/i, /fare/i, /payout/i,
  /amount/i, /earnings/i, /\bpay\b/i, /gross/i,
];
const TIP_HINTS = [/tip/i, /gratuity/i];
const BONUS_HINTS = [/bonus/i, /incentive/i, /promo/i, /quest/i, /boost/i, /adjust/i];
const REF_HINTS = [/trip.?id/i, /order.?id/i, /delivery.?id/i, /ride.?id/i, /confirmation/i, /uuid/i, /reference/i, /\bid\b/i];
const DIST_HINTS = [/distance/i, /miles/i, /\bmi\b/i, /\bkm\b/i];
const DUR_HINTS = [/duration/i, /minutes/i, /\bmin\b/i, /online/i, /hour/i];
const DESC_HINTS = [/desc/i, /memo/i, /note/i, /type/i, /service/i, /status/i];

function findColumn(headers: string[], hints: RegExp[], exclude: Set<number>): number {
  let best = -1;
  let bestScore = -1;
  headers.forEach((h, i) => {
    if (exclude.has(i)) return;
    const score = hints.findIndex((re) => re.test(h.trim()));
    if (score !== -1 && (best === -1 || score < bestScore)) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

/* ---------------- Value parsing ---------------- */

/** "$1,234.56", "(12.50)", "-$4.00", "12.34" → cents. Negative → negative. */
export function parseMoneyCents(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[$€£,\s]/g, "");
  if (s.startsWith("-")) { neg = true; s = s.slice(1); }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 100);
  return neg ? -cents : cents;
}

export function parseDateValue(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  // ISO / RFC / "MM/DD/YYYY", "M/D/YY HH:MM AM"
  const mdy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(.*)$/);
  if (mdy) {
    const [, mo, d, y, rest] = mdy;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const t = new Date(`${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}${rest ? ` ${rest}` : ""}`);
    return isNaN(t.getTime()) ? null : t;
  }
  const t = new Date(s);
  return isNaN(t.getTime()) ? null : t;
}

const CENTS_MIN = -500_000;  // adjustments can be negative, cap at ±$5,000
const CENTS_MAX = 500_000;

/* ---------------- Statement parsing ---------------- */

export function parseStatement(csvText: string, platformKey = "other"): ParseResult {
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new ParseError("The file doesn't look like a CSV with a header row plus data.");

  // Find the header row: first row containing at least one date hint and one
  // amount hint (some exports prepend title/summary rows).
  let headerIdx = -1;
  let cols: { date: number; amount: number } | null = null;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const headers = rows[i];
    const used = new Set<number>();
    const date = findColumn(headers, DATE_HINTS, used);
    if (date !== -1) used.add(date);
    const amount = findColumn(headers, AMOUNT_HINTS, used);
    if (amount !== -1) used.add(amount);
    if (date !== -1 && amount !== -1) {
      headerIdx = i;
      cols = { date, amount };
      break;
    }
  }
  if (headerIdx === -1 || !cols) {
    throw new ParseError(
      "Couldn't find date and amount columns. Export a CSV that includes a date column and an earnings/amount column.",
    );
  }

  const headers = rows[headerIdx];
  const used = new Set([cols.date, cols.amount]);
  const tip = findColumn(headers, TIP_HINTS, used);
  if (tip !== -1) used.add(tip);
  const bonus = findColumn(headers, BONUS_HINTS, used);
  if (bonus !== -1) used.add(bonus);
  const ref = findColumn(headers, REF_HINTS, used);
  if (ref !== -1) used.add(ref);
  const dist = findColumn(headers, DIST_HINTS, used);
  if (dist !== -1) used.add(dist);
  const dur = findColumn(headers, DUR_HINTS, used);
  if (dur !== -1) used.add(dur);
  const desc = findColumn(headers, DESC_HINTS, used);

  const parsed: ParsedEarning[] = [];
  let skipped = 0;
  const seenInFile = new Map<string, number>();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const earnedAt = parseDateValue(r[cols.date] ?? "");
    const amountCents = parseMoneyCents(r[cols.amount] ?? "");
    if (!earnedAt || amountCents == null || amountCents < CENTS_MIN || amountCents > CENTS_MAX) {
      skipped++;
      continue;
    }
    const tipCents = tip !== -1 ? (parseMoneyCents(r[tip] ?? "") ?? 0) : 0;
    const bonusCents = bonus !== -1 ? (parseMoneyCents(r[bonus] ?? "") ?? 0) : 0;
    const distRaw = dist !== -1 ? parseFloat(r[dist] ?? "") : NaN;
    const distanceKm = isNaN(distRaw) ? 0 : (dist !== -1 && /\bmi|miles/i.test(headers[dist]) ? distRaw * 1.609344 : distRaw);
    const durRaw = dur !== -1 ? parseFloat(r[dur] ?? "") : NaN;
    const hours = isNaN(durRaw) ? 0 : durRaw / 60;
    const noteBits = [ref !== -1 ? r[ref] : "", desc !== -1 ? r[desc] : ""].filter(Boolean);
    const canonical = `${r[cols.date]}|${r[cols.amount]}|${tip !== -1 ? r[tip] : ""}|${noteBits.join("|")}`;
    const baseHash = createHash("sha256").update(`${platformKey}|${ref !== -1 && r[ref] ? r[ref] : canonical}`).digest("hex").slice(0, 24);
    const occ = seenInFile.get(baseHash) ?? 0;
    seenInFile.set(baseHash, occ + 1);
    const importKey = `csv:${platformKey}:${baseHash}${occ ? `:${occ}` : ""}`;

    parsed.push({
      importKey,
      earnedAt,
      // "Total"-style columns already include tips/bonuses — subtract so gross
      // isn't double-counted. "Fare/pay"-style columns exclude them — keep as base.
      amountCents: /total|earnings/i.test(headers[cols.amount])
        ? Math.max(0, amountCents - Math.max(0, tipCents) - Math.max(0, bonusCents))
        : amountCents,
      tipCents,
      bonusCents,
      distanceKm: Math.round(distanceKm * 10) / 10,
      hours,
      category: "TRIP",
      notes: noteBits.length ? noteBits.join(" · ") : null,
    });
  }

  if (parsed.length === 0) throw new ParseError("No importable rows found — every row was missing a date or amount.");

  return {
    rows: parsed,
    skipped,
    headers,
    mapping: {
      date: headers[cols.date],
      amount: headers[cols.amount],
      tip: tip !== -1 ? headers[tip] : undefined,
      bonus: bonus !== -1 ? headers[bonus] : undefined,
      ref: ref !== -1 ? headers[ref] : undefined,
    },
  };
}
