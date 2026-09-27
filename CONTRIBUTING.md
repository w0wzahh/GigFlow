# Contributing to GigFlow

Thanks for considering a contribution. GigFlow is built to be a real
product, not a demo — contributions should keep that bar.

## Ways to help

- **Bug reports** — open an issue with steps to reproduce, what you
  expected, and what happened. Include your browser/Android version.
- **Offer-parser fixes** — driver apps change their layouts constantly;
  if the assistant misreads a card, a screenshot (with personal details
  removed) plus the app + platform name is the most useful report.
- **Pull requests** — bug fixes, new platforms, parser improvements, UI
  polish. Open an issue first for anything large so we can align.
- **Documentation** — corrections and clarifications are always welcome.

## Development setup

**Web app**

```bash
cd web
cp ../.env.example .env     # set APP_SECRET — see README
npm install                 # prisma generate runs via postinstall
npx prisma migrate dev      # create + migrate prisma/dev.db
npm run db:seed             # seed the platform catalog
npm run dev                 # http://localhost:3000
```

**Android companion**

```bash
cd android
# android/local.properties must point at your SDK:
#   sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk
gradle assembleDebug        # → app/build/outputs/apk/debug/app-debug.apk
```

## Ground rules

These aren't stylistic preferences — they're product guarantees:

- **No fake integrations or mock data.** If a platform lacks an official
  API, mark it `MANUAL` or `COMING_SOON` in the catalog — never simulate a
  real connection. There is no demo mode; every record is real user data.
- **Honest claims.** Do not describe accessibility-based reading as a
  platform "integration," and do not promise automation beyond what the
  code actually does.
- **Money is integer cents; distances are kilometers.** Convert for
  display at the edge only.
- **All mutations go through `/api/*`** with Zod validation and per-user
  authorization. Pages read via `lib/` functions — no duplicate fetches.
- **Privacy is a feature.** Screen content never leaves the device; sync
  is opt-in. Don't add telemetry, analytics SDKs, or third-party calls
  without an explicit discussion first.
- **Automation stays opt-in** and cancellable — auto-accept/decline must
  never become default-on.

## Code style

- **Web:** TypeScript strict, existing primitives (`Card`, `Badge`,
  `Field`, `cn()`), server components for reads, client components only
  where interactivity requires it.
- **Android:** plain Kotlin Views, no Compose/Material dependencies — the
  design system lives in `ui/Ios.kt`. Keep it dependency-free.
- Compact code; comment the *why*, not the *what*.

## Pull request checklist

- [ ] `cd web && npm run typecheck && npm run lint && npm test` pass
- [ ] `cd android && gradle assembleDebug` builds clean (if Android touched)
- [ ] No new dependencies without a reason given in the PR
- [ ] No secrets, tokens, or personal data in code, tests, or fixtures
- [ ] Docs updated if behavior changed

## Adding a platform integration

1. Implement `PlatformIntegration` in `web/src/lib/integrations/<platform>.ts`.
2. Register it in `web/src/lib/integrations/registry.ts`.
3. Set the catalog row's `status` to `IMPORT`/`MANUAL` as appropriate and
   set `adapterKey`.
4. Add adapter tests under `web/tests/integration/`.

## License

By contributing, you agree your contribution is licensed under the
[MIT License](LICENSE).
