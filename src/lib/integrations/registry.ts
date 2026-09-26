import { MockProvider } from "./mock-provider";
import type { PlatformIntegration } from "./types";

/**
 * Adapter registry.
 *
 * Adding a real integration = implement PlatformIntegration + register here +
 * mark the Platform catalog row AVAILABLE. Nothing else needs to change.
 */

const adapters = new Map<string, PlatformIntegration>();

export function registerAdapter(adapter: PlatformIntegration): void {
  adapters.set(adapter.key, adapter);
}

export function getAdapter(adapterKey: string | null | undefined): PlatformIntegration | null {
  if (!adapterKey) return null;
  return adapters.get(adapterKey) ?? null;
}

// Demo adapter used for the "Demo Provider" platform and for platforms whose
// real APIs do not support third-party driver-facing access.
registerAdapter(new MockProvider("demo"));

/**
 * Research notes (as of Sept 2026) on real platform APIs:
 *
 * - Uber: the Uber for Business / Driver APIs do not expose a general
 *   per-driver earnings/trips feed for third-party consumer apps. Driver-side
 *   data access is not publicly available. Status: UNAVAILABLE for sync.
 * - Lyft: no public driver API for earnings/trips. Status: UNAVAILABLE.
 * - DoorDash: Drive API is for merchants dispatching deliveries, not driver
 *   data. Status: UNAVAILABLE.
 * - Instacart / Grubhub / Amazon Flex: no public driver-facing APIs.
 *   Status: UNAVAILABLE.
 *
 * These platforms remain connectable in the UI only via manual data entry,
 * CSV import (future), or the demo provider. The catalog rows carry honest
 * status so users are never misled.
 */
