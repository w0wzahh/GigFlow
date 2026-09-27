# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately via GitHub Security Advisories on this repository
(**Security → Report a vulnerability**), or by contacting the maintainer
through GitHub. Include a description, reproduction steps, and the
affected component (web API, companion app, sync).

We aim to acknowledge reports within **72 hours** and will keep you
updated on the fix timeline. We appreciate coordinated disclosure — give
us a reasonable window to patch before publishing details.

## Scope

| In scope | Out of scope |
|---|---|
| Web API (`/api/*`) auth, authorization, injection | Vulnerabilities in the gig platforms themselves |
| Android companion: token handling, local storage, overlay/service security | Attacks requiring physical access to an unlocked device |
| Sync endpoints and mobile tokens | Social engineering, DoS against a hobby deployment |
| Dependency-driven issues that affect the shipped build | Purely informational scanner output without impact |

## Design notes

**Web**

- Passwords: salted scrypt (N=16384, r=8, p=1), timing-safe verification.
- Sessions: opaque 256-bit tokens, stored SHA-256-hashed; `HttpOnly`,
  `SameSite=Lax`, `Secure` in production; 30-day expiry; revocable.
- CSRF: SameSite cookies plus a same-origin `Origin` check on mutations.
- Validation: Zod at every API boundary (`src/lib/schemas.ts`).
- Authorization: every query is scoped to `userId`; object-level
  ownership is verified before mutations and deletes.
- Rate limiting: in-memory sliding window on auth endpoints.
- Secrets: `APP_SECRET` encrypts integration credentials with
  AES-256-GCM; credentials never serialize to the browser or exports.
- Injection: all queries through Prisma; the one raw aggregate uses
  parameterized bindings.
- Mobile sync tokens: generated once, stored SHA-256-hashed, scoped to
  push/read of the companion's own data — they cannot change account
  settings and can be revoked from Settings.

**Android companion**

- Screen content is processed on-device only; only distilled offer fields
  are ever synced, and only when the user configures a token.
- GPS breadcrumbs stay in the local SQLite database.
- The accessibility service is scoped to the watched driver-app packages
  declared in `accessibility_service_config.xml`; it cannot see other apps.
- The sync token lives in private app storage and is never logged.

## Known limitations

- Email delivery is a console logger in development — wire a real
  provider before deploying.
- The in-memory rate limiter is per-process; use a shared store at scale.
- SQLite is the dev target; production deployments should use PostgreSQL
  (see `docs/database.md`).
- `npm audit` reports advisories in `deepmerge-ts` reachable only through
  the `prisma` CLI devDependency — not part of the production runtime.

## Supported versions

Only the latest release is supported. Check
[Releases](https://github.com/w0wzahh/GigFlow/releases) for the current
version.
