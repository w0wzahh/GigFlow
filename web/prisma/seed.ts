/**
 * Seed the platform catalog.
 *
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { PLATFORM_CATALOG } from "../src/lib/catalog";

const db = new PrismaClient();

async function main() {
  for (const p of PLATFORM_CATALOG) {
    await db.platform.upsert({ where: { key: p.key }, update: p, create: p });
  }
  console.log(`Seeded ${PLATFORM_CATALOG.length} platforms.`);
}

main().finally(() => db.$disconnect());
