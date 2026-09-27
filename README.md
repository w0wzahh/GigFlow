# GigFlow

**Your gig work. One flow.**

GigFlow is a web platform that gives rideshare and delivery drivers a single workspace to
track earnings, expenses and mileage, evaluate incoming offers against personal rules,
plan their schedule, and understand what their time is actually worth — across Uber,
Lyft, DoorDash, Instacart, Amazon Flex and any other platform.

It is an independent product and is not affiliated with or endorsed by any gig platform.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 | SSR/server components, route handlers, long-term ecosystem |
| Language | TypeScript (strict) | Safety across the API boundary |
| Database | SQLite via Prisma 6 (dev) | Zero-service local dev; schema ports to Postgres for production |
| Auth | Custom: scrypt passwords + opaque session cookies | Full control, no provider lock-in, OAuth-ready `Account` model |
| Validation | Zod | Shared schemas at the API boundary |
| Charts | Recharts | Lightweight, composable |
| Tests | Vitest (unit + DB integration), Playwright (e2e) | Fast unit loop + real-browser flows |

## Quick start

```bash
cp .env.example .env        # set APP_SECRET (see below)
npm install                 # runs prisma generate via postinstall
npx prisma migrate dev      # create + migrate prisma/dev.db
npm run db:seed             # seed the platform catalog
npm run dev                 # http://localhost:3000
```

Generate a real secret for anything beyond local dev:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Register an account and complete onboarding. GigFlow works with **real data
only** — no demo fixtures. Populate your workspace by logging work manually or
by importing a CSV earnings statement from your platform's driver portal
(**Platforms → Import statement**).

## Project structure

```
prisma/            schema + migrations + seed
src/
  app/
    (marketing)/   landing, privacy, terms, status
    (auth)/        login, register, password reset, email verify
    (app)/         authenticated shell: dashboard, earnings, expenses,
                   mileage, offers, rules, platforms, schedule, analytics,
                   notifications, settings/*
    api/           REST route handlers — the only mutation path
    onboarding/    first-run setup wizard
  components/      UI primitives, charts, shell, feature views
  lib/
    auth/          password hashing (scrypt), sessions, tokens, mailer
    integrations/  PlatformIntegration adapter contract, registry, Gmail adapter
    rules/         declarative offer-rule engine
    import.ts      CSV statement parser with column auto-detection + dedupe
    metrics.ts     all earnings/expense/mileage aggregation
    catalog.ts     platform catalog (honest availability status)
tests/
  unit/            rules engine, dates, units, auth/crypto, CSV + receipt parsing
  integration/     DB CRUD, cascade deletes, metrics, import idempotency
  e2e/             Playwright: register → onboard → core flows
docs/              architecture, API, integrations, database notes
```

## API

All endpoints live under `/api/*`, return `{ data }` on success and
`{ error: { code, message } }` on failure, and require the session cookie
(except `/api/auth/*` public flows). Every mutation validates input with Zod,
enforces per-user ownership, and applies same-origin + rate-limit checks to
auth endpoints. See `docs/api.md`.

## Database

Normalized schema — `User`, `Account`, `Session`, `VerificationToken`,
`Platform`, `PlatformConnection`, `Vehicle`, `Trip`, `Delivery`, `Offer`,
`Earning`, `Expense`, `MileageRecord`, `Goal`, `Rule`, `ScheduleEntry`,
`Notification`, `UserPreference`. Money is integer cents; distances are km;
enum-like fields are constrained strings (see `docs/database.md` for the
Postgres migration path).

## Integrations — honest by design

Real-world constraint (as of Sept 2026): Uber, Lyft, DoorDash, Uber Eats,
Instacart, Grubhub and Amazon Flex do **not** offer public APIs for
driver-facing earnings/trip sync. Instead of faking connections, GigFlow ships
two real ingestion paths:

- **CSV statement import** — parses the earnings exports every major platform
  offers, with column auto-detection and idempotent `importKey` dedupe.
- **Gmail receipt sync** — optional, read-only OAuth; turns Uber/Lyft
  trip-receipt emails into earnings. Requires `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET` and `APP_URL`; otherwise shows "Needs setup".

Everything else is manual tracking, clearly labeled. A `PlatformIntegration`
adapter interface + registry is ready for any official API that appears.
Details: `docs/integrations.md`.

### Android companion

`android/` contains **GigFlow Driver**, a dependency-free Kotlin app that uses
Android's `AccessibilityService` to read offer cards on-screen in driver apps,
scores them against your thresholds, shows a floating verdict card, and can
optionally tap accept/decline — the same approach Mystro uses. Scored offers
sync to the web app via `POST /api/mobile/offers` using a bearer token from
**Settings → Security → Android companion app**. Build with
`gradle assembleDebug`; see `android/README.md` for setup, permissions, and
honest limitations (heuristic parsing, opt-in automation, Play-policy notes).

## Security

- scrypt password hashing (salted), timing-safe compare
- Opaque session tokens, SHA-256 hashed at rest, `HttpOnly` + `SameSite=Lax`
- Same-origin checks on mutations + Zod validation everywhere
- Per-user authorization on every query (`userId` scoping + ownership checks)
- Rate limiting on auth endpoints
- AES-256-GCM for integration credentials; secrets only via env vars
- No secrets in the repo; `.env*` is gitignored

See `SECURITY.md` for reporting and hardening notes.

## Testing

```bash
npm test                # unit + integration (vitest)
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run test:e2e        # playwright (installs its own db + server on :3100)
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | dev server |
| `npm run build` / `start` | production build / serve |
| `npm run db:migrate` | create + apply a dev migration |
| `npm run db:deploy` | apply migrations (prod) |
| `npm run db:seed` | seed platform catalog |
| `npm run db:studio` | Prisma Studio |
| `npm test` | vitest suite |
| `npm run test:e2e` | playwright suite |

## Deployment

Any Node host works. For production: switch `DATABASE_URL` + Prisma provider to
PostgreSQL (see `docs/database.md`), set a real `APP_SECRET`, set `APP_URL`, and
wire a transactional email provider into `src/lib/auth/mailer.ts`.
