/**
 * Platform integration contract.
 *
 * Every gig platform is surfaced through this adapter interface. Adapters are
 * isolated per platform; platforms without a usable API are represented by
 * catalog entries with status COMING_SOON or UNAVAILABLE — never faked.
 *
 * Credentials (when a platform supports them) are stored AES-256-GCM
 * encrypted in PlatformConnection.credentialsEnc and only ever decrypted on
 * the server.
 */

export type DriverStatus = "ONLINE" | "OFFLINE" | "ON_TRIP" | "UNKNOWN";

export type SyncedTrip = {
  externalId: string;
  startedAt: Date;
  endedAt?: Date;
  distanceKm: number;
  durationMin: number;
  pickupZone?: string;
  dropoffZone?: string;
  payoutCents: number;
  tipCents?: number;
  bonusCents?: number;
  status: "COMPLETED" | "CANCELLED";
};

export type SyncedEarning = {
  externalId?: string;
  earnedAt: Date;
  amountCents: number;
  tipCents?: number;
  bonusCents?: number;
  category: string;
  hours?: number;
  distanceKm?: number;
};

export type IntegrationCapabilities = {
  canSyncTrips: boolean;
  canSyncEarnings: boolean;
  canReadDriverStatus: boolean;
  canReceiveOffers: boolean;
};

export interface PlatformIntegration {
  /** Stable key matching Platform.adapterKey. */
  readonly key: string;
  readonly capabilities: IntegrationCapabilities;

  /**
   * Establish a connection. For OAuth platforms this returns a redirect URL;
   * for credential-based platforms it validates and stores credentials.
   * Throw to signal failure.
   */
  authenticate(input: {
    userId: string;
    connectionId: string;
    credentials?: Record<string, string>;
  }): Promise<{ redirectUrl?: string }>;

  /** Tear down the connection and revoke tokens where possible. */
  disconnect(input: { userId: string; connectionId: string }): Promise<void>;

  /** Pull incremental data since the last sync. */
  sync(input: {
    userId: string;
    connectionId: string;
    since?: Date;
  }): Promise<{ trips: SyncedTrip[]; earnings: SyncedEarning[] }>;

  getDriverStatus(input: {
    userId: string;
    connectionId: string;
  }): Promise<DriverStatus>;
}

/** Raised by adapters when a capability is not implemented for a platform. */
export class IntegrationUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationUnavailableError";
  }
}
