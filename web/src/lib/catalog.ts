import { db } from "@/lib/db";

/**
 * Platform catalog. Status reflects real integration availability — see
 * docs/integrations.md for the research behind each status.
 *
 *   IMPORT      — official earnings/statement exports exist and GigFlow can
 *                 parse them (CSV/statement import in-app)
 *   MANUAL      — no API or export pipeline; manual tracking only
 *   COMING_SOON — an integration is designed and in progress
 *   UNAVAILABLE — confirmed no viable integration path today
 *
 * There are no mock/demo platforms. Nothing here pretends to sync with a
 * provider that has no real integration.
 */

export type PlatformSeed = {
  key: string;
  name: string;
  category: "RIDESHARE" | "DELIVERY" | "SHOPPING" | "FREIGHT" | "OTHER";
  status: "IMPORT" | "MANUAL" | "COMING_SOON" | "UNAVAILABLE";
  adapterKey?: string;
  statusNote?: string;
  color: string;
  website?: string;
};

export const PLATFORM_CATALOG: PlatformSeed[] = [
  {
    key: "uber",
    name: "Uber",
    category: "RIDESHARE",
    status: "IMPORT",
    statusNote:
      "No public driver API exists. Download your payment statements from the Uber driver dashboard and import them here — or track manually.",
    color: "#000000",
    website: "https://www.uber.com",
  },
  {
    key: "uber-eats",
    name: "Uber Eats",
    category: "DELIVERY",
    status: "IMPORT",
    statusNote:
      "Courier earnings are included in Uber's payment statement exports. Import statements or track manually.",
    color: "#06c167",
    website: "https://www.ubereats.com",
  },
  {
    key: "lyft",
    name: "Lyft",
    category: "RIDESHARE",
    status: "IMPORT",
    statusNote:
      "Lyft does not offer a public driver API. Export your driving history/earnings from the driver dashboard and import it here.",
    color: "#ff00bf",
    website: "https://www.lyft.com",
  },
  {
    key: "doordash",
    name: "DoorDash",
    category: "DELIVERY",
    status: "IMPORT",
    statusNote:
      "The DoorDash Drive API serves merchants, not Dashers. Import your earnings export or track manually.",
    color: "#eb1700",
    website: "https://www.doordash.com",
  },
  {
    key: "instacart",
    name: "Instacart",
    category: "SHOPPING",
    status: "MANUAL",
    statusNote:
      "No public shopper API. Track earnings manually — imports work too if you export batch earnings.",
    color: "#43b02a",
    website: "https://www.instacart.com",
  },
  {
    key: "grubhub",
    name: "Grubhub",
    category: "DELIVERY",
    status: "MANUAL",
    statusNote: "No public driver API. Track manually or import a CSV export.",
    color: "#ff8000",
    website: "https://www.grubhub.com",
  },
  {
    key: "amazon-flex",
    name: "Amazon Flex",
    category: "DELIVERY",
    status: "MANUAL",
    statusNote: "No public driver API. Track manually or import a CSV export.",
    color: "#ff9900",
    website: "https://www.amazon.com",
  },
  {
    key: "spark",
    name: "Walmart Spark",
    category: "DELIVERY",
    status: "MANUAL",
    statusNote: "No public driver API. Track manually or import a CSV export.",
    color: "#0071ce",
  },
  {
    key: "other",
    name: "Other Platform",
    category: "OTHER",
    status: "MANUAL",
    statusNote:
      "Any gig work platform — track manually or import any CSV with date and amount columns.",
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
  // The retired demo provider is removed if it ever existed in this database.
  await db.platform.deleteMany({ where: { key: "demo" } }).catch(() => {});
}
