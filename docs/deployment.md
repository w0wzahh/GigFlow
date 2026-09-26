# Deployment

## Requirements

- Node.js 20+ (24 recommended)
- PostgreSQL for production (SQLite is dev-only)
- A transactional email provider for verification/reset flows

## Environment

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `APP_SECRET` | yes | 32+ random bytes, hex — encrypts integration credentials |
| `APP_URL` | yes | e.g. `https://app.gigflow.app` — used in emails + origin checks |
| `SMTP_URL` | prod | wire into `src/lib/auth/mailer.ts` |

Never commit secrets. `.env*` is gitignored; configure via your host's env UI.

## Build & run

```bash
npm ci
npx prisma migrate deploy
npm run db:seed          # idempotent platform catalog
npm run build
npm run start            # or run behind a process manager / platform adapter
```

## Checklist before production

- [ ] Postgres `DATABASE_URL` + `provider = "postgresql"`
- [ ] Real `APP_SECRET` (not the dev default)
- [ ] `APP_URL` set — cookies go `Secure` automatically when `NODE_ENV=production`
- [ ] Email provider wired in `lib/auth/mailer.ts` (dev falls back to console)
- [ ] Shared rate-limit store if running >1 process (see `lib/ratelimit.ts`)
- [ ] Backups for the database; exports available to users via `/api/export`
- [ ] Review `SECURITY.md` known limitations

## Platforms

Standard Next.js deployment targets work: Vercel, a Node server + reverse
proxy, or a container. The only stateful dependency is the database.
