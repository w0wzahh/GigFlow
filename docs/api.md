# API Reference

Base: `/api/*`. Auth via `gf_session` cookie. Success → `{ data: ... }`;
failure → `{ error: { code, message } }` with the appropriate status.

## Auth (public, rate-limited)

| Method | Path | Body |
|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password }` |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/logout` | — |
| POST | `/api/auth/forgot-password` | `{ email }` |
| POST | `/api/auth/reset-password` | `{ token, password }` |
| POST | `/api/auth/verify-email` | `{ token }` |
| POST | `/api/auth/resend-verification` | `{ email }` |

## Account & preferences

| Method | Path | Notes |
|---|---|---|
| GET/PATCH/DELETE | `/api/account` | profile update; DELETE removes account + cascades |
| GET/PATCH | `/api/preferences` | currency, distanceUnit, timezone, theme, notificationPrefs |
| GET | `/api/export` | full JSON export, `Content-Disposition: attachment` |
| DELETE | `/api/sessions/:id` | revoke a session (can't revoke current via this route) |
| POST | `/api/onboarding` | atomic onboarding completion (prefs + vehicle + platforms + goals) |
| POST/DELETE | `/api/demo` | generate / clear demo data |

## Vehicles

`GET/POST /api/vehicles`, `PATCH/DELETE /api/vehicles/:id`
Fields: nickname, make, model, year, fuelType, fuelEconomy, isEv, financing.

## Platforms & connections

| Method | Path | Notes |
|---|---|---|
| GET | `/api/platforms` | catalog with `status`: `AVAILABLE` / `COMING_SOON` / `UNAVAILABLE` |
| GET/POST | `/api/platforms/connections` | POST: `{ platformId }` — manual-only platforms get `MANUAL` status |
| PATCH/DELETE | `/api/platforms/connections/:id` | enable/disable, remove |
| POST | `/api/platforms/connections/:id/sync` | runs adapter `sync()`; manual connections return `NOTHING_TO_SYNC` |

## Records

All support `GET` (list, `?from=&to=` optional) and `POST`.

| Path | Fields |
|---|---|
| `/api/earnings` | platformId, occurredAt, amountCents, tipCents, bonusCents, adjustmentCents, note |
| `/api/expenses` | category, occurredAt, amountCents, description, vehicleId? |
| `/api/mileage` | occurredAt, distanceKm, purpose (`WORK`/`PERSONAL`), vehicleId, startLocation?, endLocation? |
| `/api/activities` | type (`TRIP`/`DELIVERY`), platformId, startedAt, endedAt?, distanceKm?, notes? — auto-generates an Earning when `payoutCents` given |

`PATCH/DELETE` on `/api/earnings/:id`, `/api/expenses/:id`, `/api/mileage/:id`.

## Offers & rules

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/offers` | computed eph/epk/profit server-side |
| PATCH/DELETE | `/api/offers/:id` | status: `PENDING`/`ACCEPTED`/`DECLINED`/`EXPIRED` |
| GET/POST | `/api/rules` | `{ name, priority, conditions[], action }` |
| PATCH/DELETE | `/api/rules/:id` | `enabled` toggle supported |
| POST | `/api/rules/evaluate` | dry-run: `{ offer }` → matching rule + computed metrics |

## Goals, schedule, notifications

| Method | Path |
|---|---|
| GET/POST, PATCH/DELETE | `/api/goals`, `/api/goals/:id` (type: `WEEKLY`/`MONTHLY`) |
| GET/POST, PATCH/DELETE | `/api/schedule`, `/api/schedule/:id` |
| GET, POST `/api/notifications/read` | list; mark read `{ ids? \| all: true }` |

## Aggregates

| Method | Path | Notes |
|---|---|---|
| GET | `/api/dashboard` | today/week/month + platform breakdown + goals + activity + insights |
| GET | `/api/analytics?range=&platformId=&vehicleId=` | full metrics + comparisons + day/hour/expense breakdowns |

## Error codes

`UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
`BAD_REQUEST` (400, includes `issues` from Zod), `CONFLICT` (409),
`RATE_LIMITED` (429), `INTERNAL` (500).
