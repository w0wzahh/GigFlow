# Integration Architecture

## The honest constraint

GigFlow's value depends on platform data — but as of September 2026, **none of
the major gig platforms offer a public driver-facing API** for earnings, trip
history, or offer streams:

- **Uber / Uber Eats**: the Uber Driver API does not exist for third parties;
  Uber's public APIs cover business/rideshare ordering, not driver data.
- **Lyft**: no public driver API.
- **DoorDash**: the Drive API is for merchants dispatching deliveries, not for
  Dashers' own data.
- **Instacart, Grubhub, Amazon Flex, Spark**: no public APIs for worker data.

We do not scrape, reverse-engineer, or automate platform apps — that violates
their terms and puts drivers' accounts at risk.

## What GigFlow does instead

1. **A real adapter interface** so any official API can be added cleanly:

```ts
interface PlatformIntegration {
  key: string;
  authenticate(input): Promise<AuthResult>;
  disconnect(conn): Promise<void>;
  sync(conn, since?): Promise<SyncResult>;      // trips, deliveries, earnings
  getDriverStatus(conn): Promise<DriverStatus>;
  getOffers?(conn): Promise<Offer[]>;           // where a platform supports it
}
```

2. **A demo provider** (`adapterKey: "demo"`) that generates realistic,
   clearly-marked sample data so the full product is explorable today.

3. **Manual tracking** for everything else. Unavailable platforms are marked
   `UNAVAILABLE` in the catalog; connections to them get status `MANUAL`, and
   the UI labels them "Manual tracking" — never "Connected".

## Catalog statuses

| Status | Meaning |
|---|---|
| `AVAILABLE` | An adapter is registered and can sync |
| `COMING_SOON` | Integration designed, not yet shipped |
| `UNAVAILABLE` | No official API exists — manual tracking only |

The dashboard and Platforms page render `MANUAL` connections distinctly and
never claim synchronization that didn't happen.

## Adding a real provider

1. `src/lib/integrations/<name>.ts` — implement `PlatformIntegration`.
2. Register in `registry.ts`.
3. `prisma/seed.ts` — set catalog row `status: "AVAILABLE"`, `adapterKey`.
4. Credentials are encrypted with AES-256-GCM (`lib/crypto.ts`) before storage
   in `PlatformConnection.encryptedCreds`; they never reach the browser or exports.
5. `POST /api/platforms/connections/:id/sync` drives the adapter.

## Future paths worth watching

- Platform data-portability programs (GDPR/CCPA exports) as an import source.
- Email receipt parsing (Uber/Lyft send per-trip emails) as a user-consented sync.
- Mobile companion capturing platform notifications locally — requires explicit
  platform permission.
