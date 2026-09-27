/** Unit conversion + display formatting. Distances are stored in km. */

export type DistanceUnit = "KM" | "MI";

export const KM_PER_MILE = 1.609344;

export function kmToUnit(km: number, unit: DistanceUnit): number {
  return unit === "MI" ? km / KM_PER_MILE : km;
}

export function unitToKm(value: number, unit: DistanceUnit): number {
  return unit === "MI" ? value * KM_PER_MILE : value;
}

export function unitLabel(unit: DistanceUnit): string {
  return unit === "MI" ? "mi" : "km";
}

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatDistance(km: number, unit: DistanceUnit): string {
  const v = kmToUnit(km, unit);
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${unitLabel(unit)}`;
}

export function formatDateTime(d: Date | string, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(d));
}

export function formatDate(d: Date | string, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(d));
}
