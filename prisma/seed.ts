/**
 * Seed the platform catalog and (optionally) a demo account.
 *
 *   npm run db:seed                       — catalog only
 *   SEED_DEMO=1 npm run db:seed           — also creates demo@gigflow.app / DemoDriver1
 */
import { PrismaClient } from "@prisma/client";
import { scrypt, randomBytes } from "node:crypto";

const db = new PrismaClient();

const CATALOG = [
  { key: "demo", name: "Demo Provider", category: "OTHER", status: "MOCK", adapterKey: "mock:demo", color: "#0ea5a5", statusNote: "Built-in demo integration that generates clearly-marked sample data." },
  { key: "uber", name: "Uber", category: "RIDESHARE", status: "UNAVAILABLE", color: "#000000", website: "https://www.uber.com", statusNote: "No public driver API. Track manually or via import." },
  { key: "lyft", name: "Lyft", category: "RIDESHARE", status: "UNAVAILABLE", color: "#ff00bf", website: "https://www.lyft.com", statusNote: "No public driver API. Track manually or via import." },
  { key: "doordash", name: "DoorDash", category: "DELIVERY", status: "UNAVAILABLE", color: "#eb1700", website: "https://www.doordash.com", statusNote: "No public driver data API. Track manually or via import." },
  { key: "uber-eats", name: "Uber Eats", category: "DELIVERY", status: "UNAVAILABLE", color: "#06c167", website: "https://www.ubereats.com", statusNote: "No public courier data API. Track manually or via import." },
  { key: "instacart", name: "Instacart", category: "SHOPPING", status: "UNAVAILABLE", color: "#43b02a", website: "https://www.instacart.com", statusNote: "No public shopper API. Track manually or via import." },
  { key: "grubhub", name: "Grubhub", category: "DELIVERY", status: "UNAVAILABLE", color: "#ff8000", website: "https://www.grubhub.com", statusNote: "No public driver API. Track manually or via import." },
  { key: "amazon-flex", name: "Amazon Flex", category: "DELIVERY", status: "UNAVAILABLE", color: "#ff9900", website: "https://www.amazon.com", statusNote: "No public driver API. Track manually or via import." },
  { key: "spark", name: "Walmart Spark", category: "DELIVERY", status: "COMING_SOON", color: "#0071ce", statusNote: "Integration under evaluation — no public API currently available." },
  { key: "other", name: "Other Platform", category: "OTHER", status: "AVAILABLE", color: "#64748b", statusNote: "Generic platform for manual tracking." },
];

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? reject(e) : resolve(k))),
  );
  return `scrypt:16384:8:1$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function main() {
  for (const p of CATALOG) {
    await db.platform.upsert({ where: { key: p.key }, update: p, create: p });
  }
  console.log(`Seeded ${CATALOG.length} platforms.`);

  if (process.env.SEED_DEMO === "1") {
    const user = await db.user.upsert({
      where: { email: "demo@gigflow.app" },
      update: {},
      create: {
        email: "demo@gigflow.app",
        name: "Demo Driver",
        passwordHash: await hashPassword("DemoDriver1"),
        emailVerifiedAt: new Date(),
        preference: {
          create: { currency: "USD", timezone: "America/Chicago", onboardingCompletedAt: new Date() },
        },
      },
    });
    // Mirror of lib/demo.ts without importing the Next-dependent barrel.
    const { generateDemoData } = await import("../src/lib/demo");
    const res = await generateDemoData(user.id);
    console.log(`Demo account ready: demo@gigflow.app / DemoDriver1 (${res.created} records)`);
  }
}

main().finally(() => db.$disconnect());
