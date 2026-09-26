/**
 * Integration tests against a real SQLite database (test.db).
 * The schema is pushed in beforeAll; tests clean up after themselves.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import { db } from "@/lib/db";
import { summarize, platformBreakdown } from "@/lib/metrics";
import { generateDemoData, clearDemoData, hasDemoData } from "@/lib/demo";
import { ensurePlatformCatalog } from "@/lib/catalog";
import { hashPassword } from "@/lib/auth/password";

beforeAll(async () => {
  for (const f of ["prisma/test.db", "prisma/test.db-journal"]) {
    if (existsSync(f)) rmSync(f);
  }
  execSync("npx prisma db push --skip-generate", {
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "ignore",
  });
  await ensurePlatformCatalog();
}, 120_000);

afterAll(async () => {
  await db.$disconnect();
});

async function makeUser(email: string) {
  return db.user.create({
    data: { email, passwordHash: await hashPassword("Pass1234"), preference: { create: {} } },
  });
}

describe("user + cascade", () => {
  it("creates a user with preference row", async () => {
    const u = await makeUser("a@test.dev");
    expect(await db.userPreference.findUnique({ where: { userId: u.id } })).not.toBeNull();
  });

  it("deleting a user cascades all owned data", async () => {
    const u = await makeUser("b@test.dev");
    const v = await db.vehicle.create({ data: { userId: u.id, nickname: "Car" } });
    await db.expense.create({ data: { userId: u.id, vehicleId: v.id, category: "FUEL", amountCents: 5000, occurredAt: new Date() } });
    await db.user.delete({ where: { id: u.id } });
    expect(await db.vehicle.count({ where: { userId: u.id } })).toBe(0);
    expect(await db.expense.count({ where: { userId: u.id } })).toBe(0);
    expect(await db.userPreference.count({ where: { userId: u.id } })).toBe(0);
  });
});

describe("metrics.summarize", () => {
  it("computes gross/net/hour/mile from real records", async () => {
    const u = await makeUser("m@test.dev");
    const now = Date.now();
    // Two $20 trips, 30 min, 15 km each; one $40 fuel expense.
    for (let i = 0; i < 2; i++) {
      await db.trip.create({
        data: {
          userId: u.id, startedAt: new Date(now - i * 3600000), durationMin: 30,
          distanceKm: 15, payoutCents: 1800, tipCents: 200, status: "COMPLETED",
        },
      });
      await db.earning.create({
        data: {
          userId: u.id, category: "TRIP", amountCents: 1800, tipCents: 200,
          earnedAt: new Date(now - i * 3600000), hours: 0.5, distanceKm: 15,
        },
      });
    }
    await db.expense.create({ data: { userId: u.id, category: "FUEL", amountCents: 4000, occurredAt: new Date(now) } });
    await db.mileageRecord.create({ data: { userId: u.id, date: new Date(now), distanceKm: 40, purpose: "WORK" } });

    const s = await summarize(u.id, { range: null });
    expect(s.grossCents).toBe(4000);
    expect(s.expensesCents).toBe(4000);
    expect(s.netCents).toBe(0);
    expect(s.hours).toBeCloseTo(1);
    expect(s.trips).toBe(2);
    // $40 over 1h → $40/h; over 40 km recorded mileage → $1/km
    expect(s.perHourCents).toBe(4000);
    expect(s.perKmCents).toBe(100);
  });

  it("scopes by platform", async () => {
    const u = await makeUser("p@test.dev");
    const platforms = await db.platform.findMany({ take: 2 });
    const [p1, p2] = platforms;
    await db.earning.create({ data: { userId: u.id, platformId: p1.id, category: "TRIP", amountCents: 1000, earnedAt: new Date() } });
    await db.earning.create({ data: { userId: u.id, platformId: p2.id, category: "TRIP", amountCents: 2000, earnedAt: new Date() } });

    const rows = await platformBreakdown(u.id, { range: null });
    expect(rows[0].grossCents).toBe(2000);
    const filtered = await summarize(u.id, { range: null, platformId: p2.id });
    expect(filtered.grossCents).toBe(2000);
  });
});

describe("demo data separation", () => {
  it("generates marked demo records and clears them without touching real data", async () => {
    const u = await makeUser("d@test.dev");
    // A real (manual) record that must survive cleanup.
    await db.earning.create({ data: { userId: u.id, category: "TRIP", amountCents: 9999, earnedAt: new Date(), source: "MANUAL" } });

    expect(await hasDemoData(u.id)).toBe(false);
    await generateDemoData(u.id);
    expect(await hasDemoData(u.id)).toBe(true);
    expect(await db.earning.count({ where: { userId: u.id, source: "DEMO" } })).toBeGreaterThan(50);

    await clearDemoData(u.id);
    expect(await hasDemoData(u.id)).toBe(false);
    const remaining = await db.earning.findMany({ where: { userId: u.id } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].amountCents).toBe(9999);
  });
});
