import { db } from "@/lib/db";

/**
 * Platform catalog. Status reflects real API availability — see
 * src/lib/integrations/registry.ts for research notes.
 *
 * MOCK platforms are served by the demo adapter for development.
 * UNAVAILABLE platforms support manual tracking only.
 */

export type PlatformSeed = {
  key: string;
  name: string;
  category: "RIDESHARE" | "DELIVERY" | "SHOPPING" | "FREIGHT" | "OTHER";
  status: "AVAILABLE" | "COMING_SOON" | "UNAVAILABLE" | "MOCK";
  adapterKey?: string;
  statusNote?: string;
  color: string;
  website?: string;
};

export const PLATFORM_CATALOG: PlatformSeed[] = [
  {
    key: "demo",
    name: "Demo Provider",
    category: "OTHER",
    status: "MOCK",
    adapterKey: "mock:demo",
    statusNote: "Built-in demo integration that generates clearly-marked sample data for exploring GigFlow.",
    color: "#0ea5a5",
  },
  {
    key: "uber",
    name: "Uber",
    category: "RIDESHARE",
    status: "UNAVAILABLE",
    statusNote: "Uber does not offer a public API for driver earnings or trip sync. Track manually or via import.",
    color: "#000000",
    website: "https://www.uber.com",
  },
  {
    key: "lyft",
    name: "Lyft",
    category: "RIDESHARE",
    status: "UNAVAILABLE",
    statusNote: "Lyft does not offer a public driver API. Track manually or via import.",
    color: "#ff00bf",
    website: "https://www.lyft.com",
  },
  {
    key: "doordash",
    name: "DoorDash",
    category: "DELIVERY",
    status: "UNAVAILABLE",
    statusNote: "DoorDash's Drive API serves merchants, not driver data. Track manually or via import.",
    color: "#eb1700",
    website: "https://www.doordash.com",
  },
  {
    key: "uber-eats",
    name: "Uber Eats",
    category: "DELIVERY",
    status: "UNAVAILABLE",
    statusNote: "No public courier data API. Track manually or via import.",
    color: "#06c167",
    website: "https://www.ubereats.com",
  },
  {
    key: "instacart",
    name: "Instacart",
    category: "SHOPPING",
    status: "UNAVAILABLE",
    statusNote: "No public shopper API. Track manually or via import.",
    color: "#43b02a",
    website: "https://www.instacart.com",
  },
  {
    key: "grubhub",
    name: "Grubhub",
    category: "DELIVERY",
    status: "UNAVAILABLE",
    statusNote: "No public driver API. Track manually or via import.",
    color: "#ff8000",
    website: "https://www.grubhub.com",
  },
  {
    key: "amazon-flex",
    name: "Amazon Flex",
    category: "DELIVERY",
    status: "UNAVAILABLE",
    statusNote: "No public driver API. Track manually or via import.",
    color: "#ff9900",
    website: "https://www.amazon.com",
  },
  {
    key: "spark",
    name: "Walmart Spark",
    category: "DELIVERY",
    status: "COMING_SOON",
    statusNote: "Integration under evaluation — no public API currently available.",
    color: "#0071ce",
  },
  {
    key: "other",
    name: "Other Platform",
    category: "OTHER",
    status: "AVAILABLE",
    statusNote: "Generic platform for manual tracking of any gig work.",
    color: "#64748b",
  },
];

export async function ensurePlatformCatalog(): Promise<void> {
  for (const p of PLATFORM_CATALOG) {
    await db.platform.upsert({
      where: { key: p.key },
      update: {
        name: p.name,
        category: p.category,
        status: p.status,
        adapterKey: p.adapterKey ?? null,
        statusNote: p.statusNote ?? null,
        color: p.color,
        website: p.website ?? null,
      },
      create: {
        key: p.key,
        name: p.name,
        category: p.category,
        status: p.status,
        adapterKey: p.adapterKey ?? null,
        statusNote: p.statusNote ?? null,
        color: p.color,
        website: p.website ?? null,
      },
    });
  }
}
