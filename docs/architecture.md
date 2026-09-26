# Architecture

## Request flow

```
Browser → Next.js route handler (/api/*)
        → requireUser()               session + same-origin + rate limit
        → Zod schema validation       src/lib/schemas.ts
        → ownership check             every query scoped to userId
        → Prisma → SQLite (dev) / Postgres (prod)
        → { data } or { error: { code, message } }
```

Server components read data by calling `src/lib/*` aggregation functions
directly (`lib/dashboard.ts`, `lib/analytics.ts`, `lib/metrics.ts`) — they never
fetch their own API over HTTP. Client components mutate only via `/api/*`.

## Layers

| Layer | Location | Responsibility |
|---|---|---|
| Pages | `src/app/**` | Composition, loading/empty/error states |
| Views | `src/components/*-view.tsx` | Interactive feature UIs (client components) |
| API | `src/app/api/**` | Validation, auth, authorization |
| Domain | `src/lib/*` | Metrics, rules, catalog, demo, notifications |
| Adapters | `src/lib/integrations/*` | PlatformIntegration contract + registry |
| Data | `prisma/` | Schema, migrations, seed |

## Money, distance, time

- **Money**: integer cents everywhere (`amountCents`, `payoutCents`).
  `formatMoney()` converts for display only.
- **Distance**: kilometers stored; `src/lib/units.ts` converts to the user's
  preferred unit at render.
- **Time**: UTC timestamps stored; `src/lib/dates.ts` computes day/week/month
  ranges in the user's timezone (`zonedTimeToUtc`).

## Metrics

`src/lib/metrics.ts` is the single source of truth for aggregation:

- `summarize()` → gross, tips, bonuses, expenses, net, hours, distance, jobs
- `perHour` / `perKm` / `avgJob` derived metrics
- `dailySeries()`, `platformBreakdown()`, `expenseMix()`
- `insights()` → computed comparisons vs. previous period (never fabricated)

`lib/dashboard.ts` composes these into the dashboard payload; `lib/analytics.ts`
into the filterable analytics payload. Both are shared by the API routes and
server components.

## Rules engine

`src/lib/rules/engine.ts` evaluates offers against user-defined rules:

```
rule = { priority, conditions: [{ field, op, value }], action }
```

Fields: `payout_cents`, `earnings_per_hour_cents`, `earnings_per_km_cents`,
`est_distance_km`, `est_duration_min`, `profit_cents`, `platform_name`.
Operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`. Rules are evaluated in
priority order; first match wins. The offers view runs the same engine
client-side for live preview.

## Integrations

`PlatformIntegration` (see `integrations.md`) abstracts `authenticate`,
`disconnect`, `sync`, `getDriverStatus`, `getTrips`, `getEarnings`,
`getOffers`. A registry maps `adapterKey` → adapter instance. Only the demo
provider ships; real providers slot in without touching product code.

## Notifications

`src/lib/notifications.ts` creates in-app notifications for goal milestones,
rule matches, sync events, and account events. User preferences gate categories
(`notificationPrefs` on `UserPreference`).

## Error model

Every API returns `{ error: { code, message } }` where `code` is one of
`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `CONFLICT`,
`RATE_LIMITED`, `INTERNAL`. Users never see stack traces; `app/error.tsx` and
`not-found.tsx` render safe fallbacks.
