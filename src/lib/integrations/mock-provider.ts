import type {
  DriverStatus,
  PlatformIntegration,
  SyncedEarning,
  SyncedTrip,
} from "./types";

/**
 * Demo provider — a deterministic pseudo-integration used for development
 * and demo data. It never talks to a real network; it synthesizes plausible
 * records so the sync pipeline, dashboards, and analytics can be exercised.
 *
 * Records produced by this adapter are always persisted with source="DEMO"
 * (callers enforce this), keeping demo data clearly separated from real data.
 */

// Deterministic PRNG so repeated syncs don't explode data volume.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ZONES = [
  "Downtown", "Airport", "University District", "Old Town",
  "Riverside", "North Market", "Stadium District", "Harbor",
];

export class MockProvider implements PlatformIntegration {
  readonly key: string;
  readonly capabilities = {
    canSyncTrips: true,
    canSyncEarnings: true,
    canReadDriverStatus: true,
    canReceiveOffers: true,
  };

  constructor(platformKey = "demo") {
    this.key = `mock:${platformKey}`;
  }

  async authenticate(): Promise<{ redirectUrl?: string }> {
    // Mock connections succeed immediately — no credentials required.
    return {};
  }

  async disconnect(): Promise<void> {
    // Nothing to revoke.
  }

  async getDriverStatus(): Promise<DriverStatus> {
    return "OFFLINE";
  }

  async sync(input: {
    userId: string;
    connectionId: string;
    since?: Date;
  }): Promise<{ trips: SyncedTrip[]; earnings: SyncedEarning[] }> {
    const since = input.since ?? new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const rand = mulberry32(
      // Stable seed per connection+window so re-syncs produce the same set.
      Math.abs(hashCode(input.connectionId)) + Math.floor(since.getTime() / 86400000),
    );
    const days = Math.max(1, Math.min(14, Math.ceil((Date.now() - since.getTime()) / 86400000)));
    const trips: SyncedTrip[] = [];
    const earnings: SyncedEarning[] = [];
    for (let d = 0; d < days; d++) {
      const day = new Date(since.getTime() + d * 86400000);
      const count = 2 + Math.floor(rand() * 5);
      for (let i = 0; i < count; i++) {
        const start = new Date(day.getTime() + (8 + rand() * 10) * 3600 * 1000);
        const durationMin = 8 + rand() * 35;
        const distanceKm = 2 + rand() * 18;
        const payoutCents = Math.round(distanceKm * 140 + durationMin * 25 + rand() * 300);
        const tipCents = rand() > 0.55 ? Math.round(rand() * 800) : 0;
        const ext = `mock-${input.connectionId.slice(-6)}-${day.toISOString().slice(0, 10)}-${i}`;
        trips.push({
          externalId: ext,
          startedAt: start,
          endedAt: new Date(start.getTime() + durationMin * 60000),
          distanceKm: Math.round(distanceKm * 10) / 10,
          durationMin: Math.round(durationMin),
          pickupZone: ZONES[Math.floor(rand() * ZONES.length)],
          dropoffZone: ZONES[Math.floor(rand() * ZONES.length)],
          payoutCents,
          tipCents,
          status: "COMPLETED",
        });
        earnings.push({
          externalId: ext,
          earnedAt: start,
          amountCents: payoutCents,
          tipCents,
          category: "TRIP",
          hours: durationMin / 60,
          distanceKm,
        });
      }
    }
    return { trips, earnings };
  }
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}
