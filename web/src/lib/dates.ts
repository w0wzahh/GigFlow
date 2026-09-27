/**
 * Date-range helpers. All boundaries are computed in the supplied IANA
 * timezone so "today" matches the user's day, not the server's.
 */

export type RangeKey = "today" | "week" | "month" | "year" | "all" | "custom";

export type DateRange = { start: Date; end: Date };

function tzOffset(date: Date, timeZone: string): number {
  // Difference between the wall-clock in `timeZone` and UTC, in ms.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUTC = Date.UTC(
    get("year"), get("month") - 1, get("day"),
    get("hour"), get("minute"), get("second"),
  );
  return asUTC - date.getTime();
}

/** Convert a local wall-clock time in `timeZone` to a UTC Date. */
export function zonedTimeToUtc(
  y: number, m: number, d: number,
  hh: number, mm: number, ss: number,
  timeZone: string,
  ms = 0,
): Date {
  const guessSec = Date.UTC(y, m - 1, d, hh, mm, ss);
  const off = tzOffset(new Date(guessSec), timeZone);
  return new Date(guessSec - off + ms);
}

function nowParts(timeZone: string) {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hourCycle: "h23",
  });
  const parts = dtf.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    dow: weekdays.indexOf(get("weekday")),
  };
}

export function periodRange(key: RangeKey, timeZone: string, custom?: { start?: string; end?: string }): DateRange | null {
  const p = nowParts(timeZone);
  const endOfDay = (y: number, m: number, d: number) =>
    zonedTimeToUtc(y, m, d, 23, 59, 59, timeZone, 999);
  const startOfDay = (y: number, m: number, d: number) =>
    zonedTimeToUtc(y, m, d, 0, 0, 0, timeZone);

  switch (key) {
    case "today":
      return { start: startOfDay(p.y, p.m, p.d), end: endOfDay(p.y, p.m, p.d) };
    case "week": {
      // Week starts Monday.
      const delta = (p.dow + 6) % 7;
      const start = startOfDay(p.y, p.m, p.d - delta);
      return { start, end: endOfDay(p.y, p.m, p.d - delta + 6) };
    }
    case "month":
      return {
        start: startOfDay(p.y, p.m, 1),
        end: endOfDay(p.y, p.m + 1, 0),
      };
    case "year":
      return { start: startOfDay(p.y, 1, 1), end: endOfDay(p.y, 12, 31) };
    case "custom": {
      const s = custom?.start ? new Date(custom.start) : null;
      const e = custom?.end ? new Date(custom.end) : null;
      if (!s || !e || isNaN(s.getTime()) || isNaN(e.getTime())) return null;
      const sp = { y: s.getUTCFullYear(), m: s.getUTCMonth() + 1, d: s.getUTCDate() };
      const ep = { y: e.getUTCFullYear(), m: e.getUTCMonth() + 1, d: e.getUTCDate() };
      return { start: startOfDay(sp.y, sp.m, sp.d), end: endOfDay(ep.y, ep.m, ep.d) };
    }
    case "all":
      return null; // no bound
  }
}

/** The period immediately before `range` with the same length. */
export function previousRange(range: DateRange): DateRange {
  const len = range.end.getTime() - range.start.getTime() + 1;
  return {
    start: new Date(range.start.getTime() - len),
    end: new Date(range.start.getTime() - 1),
  };
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
