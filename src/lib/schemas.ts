import { z } from "zod";

/** Shared request validation schemas for the API boundary. */

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128)
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), {
    message: "Password must contain letters and numbers.",
  });

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().max(80).optional().default(""),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const vehicleSchema = z.object({
  nickname: z.string().trim().min(1).max(60),
  make: z.string().trim().max(40).nullish(),
  model: z.string().trim().max(40).nullish(),
  year: z.number().int().min(1980).max(2100).nullish(),
  fuelType: z.enum(["GAS", "DIESEL", "HYBRID", "EV", "OTHER"]).nullish(),
  fuelEconomy: z.number().min(0).max(50).nullish(),
  batteryKwh: z.number().min(0).max(300).nullish(),
  financing: z.enum(["OWNED", "FINANCED", "LEASED", "RENTAL"]).nullish(),
  monthlyCostCents: z.number().int().min(0).nullish(),
  isDefault: z.boolean().optional(),
});

export const earningSchema = z.object({
  platformId: z.string().nullish(),
  category: z.enum(["TRIP", "DELIVERY", "TIP", "BONUS", "ADJUSTMENT", "QUEST", "OTHER"]).default("OTHER"),
  amountCents: z.number().int(),
  tipCents: z.number().int().min(0).default(0),
  bonusCents: z.number().int().min(0).default(0),
  adjustmentsCents: z.number().int().default(0),
  earnedAt: z.string().datetime({ offset: true }).or(z.string().date()),
  hours: z.number().min(0).max(24).default(0),
  distanceKm: z.number().min(0).default(0),
  notes: z.string().trim().max(500).nullish(),
});

export const expenseSchema = z.object({
  vehicleId: z.string().nullish(),
  category: z.enum([
    "FUEL", "CHARGING", "MAINTENANCE", "INSURANCE", "PARKING",
    "TOLLS", "CAR_PAYMENT", "LEASE", "PHONE", "OTHER",
  ]),
  amountCents: z.number().int().min(1),
  occurredAt: z.string().datetime({ offset: true }).or(z.string().date()),
  description: z.string().trim().max(300).nullish(),
});

export const mileageSchema = z.object({
  vehicleId: z.string().nullish(),
  date: z.string().datetime({ offset: true }).or(z.string().date()),
  distanceKm: z.number().min(0.01),
  purpose: z.enum(["WORK", "PERSONAL", "OTHER"]).default("WORK"),
  startLocation: z.string().trim().max(120).nullish(),
  endLocation: z.string().trim().max(120).nullish(),
});

export const activitySchema = z.object({
  kind: z.enum(["TRIP", "DELIVERY"]),
  platformId: z.string().nullish(),
  vehicleId: z.string().nullish(),
  startedAt: z.string().datetime({ offset: true }),
  endedAt: z.string().datetime({ offset: true }).nullish(),
  distanceKm: z.number().min(0).default(0),
  durationMin: z.number().min(0).default(0),
  pickupZone: z.string().trim().max(120).nullish(),
  dropoffZone: z.string().trim().max(120).nullish(),
  payoutCents: z.number().int().min(0).default(0),
  tipCents: z.number().int().min(0).default(0),
  bonusCents: z.number().int().min(0).default(0),
  itemsCount: z.number().int().min(0).nullish(),
});

export const offerSchema = z.object({
  platformId: z.string().nullish(),
  pickup: z.string().trim().max(120).nullish(),
  destination: z.string().trim().max(120).nullish(),
  estDistanceKm: z.number().min(0).default(0),
  estDurationMin: z.number().min(0).default(0),
  payoutCents: z.number().int().min(0).default(0),
  tipCents: z.number().int().min(0).default(0),
});

export const ruleConditionSchema = z.object({
  field: z.enum([
    "payout_cents", "earnings_per_hour_cents", "earnings_per_km_cents",
    "est_distance_km", "est_duration_min", "profit_cents", "platform_name",
  ]),
  op: z.enum(["gte", "lte", "gt", "lt", "eq", "neq", "contains"]),
  value: z.union([z.number(), z.string()]),
});

export const ruleSchema = z.object({
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(1000).default(0),
  conditions: z.array(ruleConditionSchema).min(1).max(10),
  action: z.object({
    label: z.string().trim().min(1).max(60),
    notify: z.boolean().optional(),
  }),
});

export const goalSchema = z.object({
  name: z.string().trim().max(80).default(""),
  period: z.enum(["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"]),
  targetCents: z.number().int().min(1),
  startDate: z.string().date().nullish(),
  endDate: z.string().date().nullish(),
  active: z.boolean().default(true),
});

export const scheduleSchema = z.object({
  title: z.string().trim().max(80).nullish(),
  dayOfWeek: z.number().int().min(0).max(6).nullish(),
  date: z.string().date().nullish(),
  startMin: z.number().int().min(0).max(1439),
  endMin: z.number().int().min(1).max(1440),
  zone: z.string().trim().max(80).nullish(),
  platformIds: z.array(z.string()).max(12).nullish(),
  targetCents: z.number().int().min(0).nullish(),
}).refine((v) => v.endMin > v.startMin, { message: "End time must be after start time." });

export const preferencesSchema = z.object({
  currency: z.string().length(3).optional(),
  country: z.string().max(2).optional(),
  timezone: z.string().max(60).optional(),
  distanceUnit: z.enum(["MI", "KM"]).optional(),
  theme: z.enum(["LIGHT", "DARK", "SYSTEM"]).optional(),
  targetHourlyCents: z.number().int().min(0).nullish(),
  weeklyGoalCents: z.number().int().min(0).nullish(),
  notificationPrefs: z.record(z.string(), z.boolean()).optional(),
  privacy: z.record(z.string(), z.unknown()).optional(),
});

export const onboardingSchema = z.object({
  name: z.string().trim().max(80).optional(),
  currency: z.string().length(3).default("USD"),
  country: z.string().max(2).default("US"),
  timezone: z.string().max(60).default("UTC"),
  distanceUnit: z.enum(["MI", "KM"]).default("MI"),
  targetHourlyCents: z.number().int().min(0).nullish(),
  weeklyGoalCents: z.number().int().min(0).nullish(),
  platformKeys: z.array(z.string()).max(20).default([]),
  vehicle: vehicleSchema.nullish(),
  enableDemo: z.boolean().default(false),
});
