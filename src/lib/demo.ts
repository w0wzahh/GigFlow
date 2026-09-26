import { db } from "@/lib/db";
import { ensurePlatformCatalog } from "@/lib/catalog";

/**
 * Demo data generator.
 *
 * Every record is written with source="DEMO" so it is clearly marked and can
 * be removed cleanly without touching real user-entered data.
 */

const ZONES = [
  "Downtown", "Airport", "University District", "Old Town",
  "Riverside", "North Market", "Stadium District", "Harbor",
];

function rand(seedRef: { s: number }): number {
  // deterministic per-user generator
  seedRef.s = (seedRef.s * 1103515245 + 12345) % 2147483648;
  return seedRef.s / 2147483648;
}

export async function hasDemoData(userId: string): Promise<boolean> {
  const e = await db.earning.findFirst({ where: { userId, source: "DEMO" }, select: { id: true } });
  return !!e;
}

export async function generateDemoData(userId: string): Promise<{ created: number }> {
  await ensurePlatformCatalog();
  const seed = { s: [...userId].reduce((a, c) => a + c.charCodeAt(0), 7) };

  const demoPlatform = await db.platform.upsert({
    where: { key: "demo" },
    update: {},
    create: { key: "demo", name: "Demo Provider", category: "OTHER", status: "MOCK", adapterKey: "mock:demo", color: "#0ea5a5" },
  });
  const otherPlatforms = await db.platform.findMany({
    where: { key: { in: ["uber", "doordash", "lyft", "uber-eats"] } },
  });
  const usable = [demoPlatform, ...otherPlatforms];

  // Connect demo platform + a couple of "manual tracking" platforms.
  for (const p of usable.slice(0, 4)) {
    await db.platformConnection.upsert({
      where: { userId_platformId: { userId, platformId: p.id } },
      update: {},
      create: {
        userId,
        platformId: p.id,
        status: p.id === demoPlatform.id ? "MOCK" : "MANUAL",
        lastSyncAt: p.id === demoPlatform.id ? new Date() : null,
      },
    });
  }

  let vehicle = await db.vehicle.findFirst({ where: { userId, nickname: "Demo Sedan" } });
  if (!vehicle) {
    vehicle = await db.vehicle.create({
      data: {
        userId, nickname: "Demo Sedan", make: "Toyota", model: "Camry",
        year: 2021, fuelType: "HYBRID", fuelEconomy: 5.6, isDefault: true,
      },
    });
  }

  let created = 0;
  const now = Date.now();

  // ~45 days of trips/deliveries with matching earnings + mileage.
  for (let d = 45; d >= 0; d--) {
    if (rand(seed) < 0.18) continue; // days off
    const dayStart = now - d * 86400000;
    const jobs = 3 + Math.floor(rand(seed) * 7);
    let dayKm = 0;
    for (let i = 0; i < jobs; i++) {
      const platform = usable[Math.floor(rand(seed) * usable.length)];
      const start = new Date(dayStart + (7 + rand(seed) * 11) * 3600000);
      const durationMin = 10 + rand(seed) * 40;
      const distanceKm = 2 + rand(seed) * 20;
      dayKm += distanceKm;
      const isDelivery = platform.category === "DELIVERY" || platform.category === "SHOPPING";
      const payoutCents = Math.round(distanceKm * 135 + durationMin * 24 + rand(seed) * 400);
      const tipCents = rand(seed) > 0.5 ? Math.round(rand(seed) * 900) : 0;
      const bonusCents = rand(seed) > 0.92 ? Math.round(200 + rand(seed) * 600) : 0;
      const source = platform.id === demoPlatform.id ? "DEMO" : "DEMO";

      const base = {
        userId, platformId: platform.id, vehicleId: vehicle.id,
        startedAt: start, endedAt: new Date(start.getTime() + durationMin * 60000),
        distanceKm: Math.round(distanceKm * 10) / 10,
        durationMin: Math.round(durationMin),
        pickupZone: ZONES[Math.floor(rand(seed) * ZONES.length)],
        dropoffZone: ZONES[Math.floor(rand(seed) * ZONES.length)],
        payoutCents, tipCents, bonusCents, status: "COMPLETED", source,
      };
      if (isDelivery) {
        await db.delivery.create({ data: { ...base, itemsCount: 1 + Math.floor(rand(seed) * 6) } });
      } else {
        await db.trip.create({ data: base });
      }
      await db.earning.create({
        data: {
          userId, platformId: platform.id, category: isDelivery ? "DELIVERY" : "TRIP",
          amountCents: payoutCents, tipCents, bonusCents,
          earnedAt: start, hours: durationMin / 60, distanceKm,
          source: "DEMO",
        },
      });
      created++;
    }
    await db.mileageRecord.create({
      data: {
        userId, vehicleId: vehicle.id, date: new Date(dayStart),
        distanceKm: Math.round((dayKm * 1.35) * 10) / 10, // deadhead included
        purpose: "WORK", source: "DEMO",
      },
    });
  }

  // Expenses: fuel every few days + recurring costs.
  const expenseSeeds: { cat: string; min: number; max: number; daysAgo: number[]; desc: string }[] = [
    { cat: "FUEL", min: 2800, max: 5200, daysAgo: [2, 6, 10, 14, 18, 23, 28, 33, 38, 43], desc: "Fuel fill-up" },
    { cat: "MAINTENANCE", min: 4500, max: 18000, daysAgo: [12, 40], desc: "Maintenance" },
    { cat: "INSURANCE", min: 12000, max: 14000, daysAgo: [15, 44], desc: "Rideshare insurance" },
    { cat: "TOLLS", min: 250, max: 1400, daysAgo: [3, 9, 17, 26, 35], desc: "Tolls" },
    { cat: "PHONE", min: 5500, max: 5500, daysAgo: [20], desc: "Phone plan" },
    { cat: "PARKING", min: 300, max: 1200, daysAgo: [5, 19, 30], desc: "Parking" },
  ];
  for (const e of expenseSeeds) {
    for (const d of e.daysAgo) {
      await db.expense.create({
        data: {
          userId, vehicleId: vehicle.id, category: e.cat,
          amountCents: Math.round(e.min + rand(seed) * (e.max - e.min)),
          occurredAt: new Date(now - d * 86400000),
          description: e.desc, source: "DEMO",
        },
      });
      created++;
    }
  }

  // Weekly goal + a couple of sample rules.
  const goal = await db.goal.findFirst({ where: { userId, period: "WEEKLY", active: true } });
  if (!goal) {
    await db.goal.create({
      data: { userId, name: "Weekly earnings goal", period: "WEEKLY", targetCents: 100000 },
    });
  }
  const hasRules = await db.rule.count({ where: { userId } });
  if (hasRules === 0) {
    await db.rule.createMany({
      data: [
        {
          userId, name: "Good offer", priority: 1,
          conditionsJson: JSON.stringify([
            { field: "earnings_per_hour_cents", op: "gte", value: 2500 },
            { field: "earnings_per_km_cents", op: "gte", value: 124 }, // ~$2/mi
          ]),
          actionJson: JSON.stringify({ label: "Good Offer", notify: false }),
        },
        {
          userId, name: "Too cheap", priority: 2,
          conditionsJson: JSON.stringify([
            { field: "earnings_per_hour_cents", op: "lt", value: 1500 },
          ]),
          actionJson: JSON.stringify({ label: "Below Target", notify: false }),
        },
      ],
    });
  }

  // Sample evaluated offers.
  for (let i = 0; i < 8; i++) {
    const platform = usable[Math.floor(rand(seed) * usable.length)];
    const distanceKm = 1.5 + rand(seed) * 22;
    const durationMin = 8 + rand(seed) * 45;
    const payoutCents = Math.round(400 + distanceKm * (80 + rand(seed) * 160));
    await db.offer.create({
      data: {
        userId, platformId: platform.id,
        pickup: ZONES[Math.floor(rand(seed) * ZONES.length)],
        destination: ZONES[Math.floor(rand(seed) * ZONES.length)],
        estDistanceKm: Math.round(distanceKm * 10) / 10,
        estDurationMin: Math.round(durationMin),
        payoutCents,
        tipCents: rand(seed) > 0.6 ? Math.round(rand(seed) * 700) : 0,
        status: ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED"][Math.floor(rand(seed) * 4)],
        receivedAt: new Date(now - rand(seed) * 2 * 86400000),
        source: "DEMO",
      },
    });
    created++;
  }

  return { created };
}

/** Remove all demo-sourced records. Real (MANUAL/SYNC) data is untouched. */
export async function clearDemoData(userId: string): Promise<void> {
  await db.$transaction([
    db.earning.deleteMany({ where: { userId, source: "DEMO" } }),
    db.trip.deleteMany({ where: { userId, source: "DEMO" } }),
    db.delivery.deleteMany({ where: { userId, source: "DEMO" } }),
    db.expense.deleteMany({ where: { userId, source: "DEMO" } }),
    db.mileageRecord.deleteMany({ where: { userId, source: "DEMO" } }),
    db.offer.deleteMany({ where: { userId, source: "DEMO" } }),
    db.platformConnection.deleteMany({
      where: { userId, platform: { key: "demo" } },
    }),
  ]);
}
