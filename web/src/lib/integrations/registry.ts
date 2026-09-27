import type { PlatformIntegration } from "./types";

/**
 * Adapter registry.
 *
 * Adding a real integration = implement PlatformIntegration + register here +
 * mark the Platform catalog row IMPORT/MANUAL as appropriate. Nothing else
 * needs to change.
 *
 * There are no mock adapters. A platform either has a real implemented
 * adapter or it doesn't.
 */

const adapters = new Map<string, PlatformIntegration>();

export function registerAdapter(adapter: PlatformIntegration): void {
  adapters.set(adapter.key, adapter);
}

export function getAdapter(adapterKey: string | null | undefined): PlatformIntegration | null {
  if (!adapterKey) return null;
  return adapters.get(adapterKey) ?? null;
}

/**
 * Integration reality (as of Sept 2026) — see docs/integrations.md:
 *
 * - No major gig platform (Uber, Lyft, DoorDash, Instacart, Grubhub,
 *   Amazon Flex, Walmart Spark) offers a public driver-data API. Products
 *   like Mystro work via Android Accessibility automation — an on-device
 *   screen-reading approach that doesn't translate to a web app and has
 *   been condemned by Google.
 * - Legitimate web-app data sources that ARE implemented:
 *     1. CSV statement import (src/lib/import.ts) — every major platform
 *        lets drivers download earnings exports.
 *     2. Gmail receipt sync (src/lib/integrations/gmail.ts) — read-only
 *        OAuth, parses per-trip receipt emails into earnings.
 *     3. Manual tracking for everything else.
 * - This registry stays for future official APIs: implement
 *   PlatformIntegration, registerAdapter(), set the catalog adapterKey.
 */
