# Database

SQLite via Prisma 6 for local development. The schema is designed to port to
PostgreSQL for production with minimal changes.

## Conventions

- IDs: `cuid()` strings.
- Money: integer cents (`Int`). Never floats.
- Distance: kilometers (`Float`). Display conversion in `src/lib/units.ts`.
- Timestamps: UTC `DateTime`; timezone-aware ranges computed in `src/lib/dates.ts`.
- Enum-like fields: constrained `String` columns (SQLite has no enums). Valid
  values are enforced by Zod schemas at the API boundary and documented below.
  On Postgres these can become real enums.
- Record provenance: `source: "MANUAL" | "IMPORT" | "SYNC"` on Earning,
  Expense, MileageRecord, Trip, Delivery, Offer. `Earning.importKey` gives
  imported rows a stable idempotency key.
- Cascades: everything a user owns is `onDelete: Cascade`.

## Entity map

| Model | Key fields | Indexes |
|---|---|---|
| `User` | email (unique), name, passwordHash, emailVerifiedAt | email |
| `Account` | userId, provider, providerAccountId | (provider, providerAccountId) unique — OAuth-ready |
| `Session` | userId, tokenHash (unique), expiresAt, lastUsedAt, ip, userAgent | userId |
| `VerificationToken` | userId, type (`EMAIL_VERIFY`/`PASSWORD_RESET`), tokenHash, expiresAt, usedAt | (type, tokenHash) |
| `Platform` | slug (unique), name, color, category, status, adapterKey | slug |
| `PlatformConnection` | userId, platformId, status (`MANUAL`/`CONNECTED`/`ERROR`/`DISABLED`), lastSyncAt, encryptedCreds | (userId, platformId) unique |
| `Vehicle` | userId, nickname, make, model, year, fuelType, fuelEconomy, isEv | userId |
| `Trip` / `Delivery` | userId, platformId, vehicleId?, startedAt, endedAt?, distanceKm?, payoutCents?, tipCents?, source | userId+startedAt, platformId |
| `Offer` | userId, platformId, pickup, destination, estDistanceKm, estDurationMin, payoutCents, tipCents?, estExpenseCents?, status | userId+createdAt |
| `Earning` | userId, platformId, occurredAt, amountCents, tipCents, bonusCents, adjustmentCents, source | userId+occurredAt, platformId |
| `Expense` | userId, vehicleId?, category, occurredAt, amountCents, source | userId+occurredAt, category |
| `MileageRecord` | userId, vehicleId?, occurredAt, distanceKm, purpose (`WORK`/`PERSONAL`), source | userId+occurredAt |
| `Goal` | userId, type (`WEEKLY`/`MONTHLY`), targetCents, isActive | userId |
| `Rule` | userId, name, priority, enabled, conditions (JSON), action (JSON) | userId |
| `ScheduleEntry` | userId, dayOfWeek, startMin, endMin, zone?, targetCents?, platformIds | userId |
| `Notification` | userId, type, title, body, readAt, meta | userId+createdAt |
| `UserPreference` | userId (unique), currency, distanceUnit, timezone, theme, targetHourlyCents?, notificationPrefs | userId |

## Migrations

```bash
npm run db:migrate    # dev: creates + applies a new migration
npm run db:deploy     # prod: applies pending migrations
npm run db:seed       # platform catalog
```

## Moving to PostgreSQL

1. Change `provider = "postgresql"` in `prisma/schema.prisma`.
2. Point `DATABASE_URL` at Postgres, e.g. `postgresql://user:pass@host:5432/gigflow`.
3. `npx prisma migrate dev` — Prisma maps `String` enums-friendly columns,
   `DateTime` → `timestamptz`, cents stay `Int`.
4. Optionally convert constrained strings to real enums in a follow-up migration.
5. Swap the in-memory rate limiter for Redis when running multiple processes.
