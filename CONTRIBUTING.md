# Contributing to GigFlow

## Setup

1. `cd web`, `cp .env.example .env` and set `APP_SECRET`.
2. `npm install && npx prisma migrate dev && npm run db:seed`
3. `npm run dev`

## Ground rules

- **No fake integrations or mock data.** If a platform lacks an official API,
  mark it `MANUAL` or `COMING_SOON` in the catalog — never simulate a real
  connection. There is no demo mode; every record is real user data.
- **Money is integer cents.** Distances are kilometers. Convert at the edge only.
- **All mutations go through `/api/*`** with Zod validation and per-user
  authorization. Pages read via `lib/` functions directly — no duplicate fetches.
- Run `npm test`, `npm run typecheck`, and `npm run lint` before submitting.

## Adding a platform integration

1. Implement `PlatformIntegration` in `src/lib/integrations/<platform>.ts`.
2. Register it in `src/lib/integrations/registry.ts`.
3. Flip the catalog row's `status` to `IMPORT`/`MANUAL` as appropriate and set `adapterKey`.
4. Add adapter tests under `tests/integration/`.

## Style

- Follow existing patterns (Card/Badge/Field primitives, `cn()` for classes).
- Compact, no comments unless the "why" is non-obvious.
- Server components for reads; client components only where interactivity requires it.
