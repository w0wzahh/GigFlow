# Security Policy

## Reporting a vulnerability

Please report security issues privately to **security@gigflow.app** (or the
repository's private security advisory channel). Do not open public issues for
vulnerabilities. We aim to acknowledge reports within 72 hours.

## Design notes

- Passwords: salted scrypt (N=16384, r=8, p=1), timing-safe verification.
- Sessions: opaque 256-bit tokens stored SHA-256-hashed; `HttpOnly`,
  `SameSite=Lax`, `Secure` in production; 30-day expiry; revocable per-session.
- CSRF: SameSite cookies + same-origin `Origin` check on mutations.
- Validation: Zod schemas at every API boundary (`src/lib/schemas.ts`).
- Authorization: every query is scoped to `userId`; object-level ownership is
  verified before mutations/deletes.
- Rate limiting: in-memory sliding window on auth endpoints (register, login,
  forgot/reset password, verification resend). Swap for Redis at scale.
- Secrets: `APP_SECRET` encrypts integration credentials with AES-256-GCM.
  No credentials are ever serialized to the browser or included in exports.
- Injection: all queries go through Prisma; the one raw aggregate query uses
  parameterized bindings only.
- Record provenance is explicit (`source: MANUAL | IMPORT | SYNC`); OAuth tokens
  for Gmail sync are stored AES-256-GCM-encrypted and never leave the server.

## Known limitations / roadmap

- Email delivery is a console logger in dev — wire a real provider before prod.
- The in-memory rate limiter is per-process; use a shared store if scaling out.
- SQLite is a dev target; production deployments should use PostgreSQL.
- `npm audit` reports 3 high-severity advisories in `deepmerge-ts`, reachable only
  through the `prisma` CLI devDependency — it is not part of the production
  runtime. The current fix path requires a breaking Prisma downgrade; track and
  upgrade Prisma when a patched release line lands.
