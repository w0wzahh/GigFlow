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

**Android app** (the public repo)

```bash
cd android
# android/local.properties must point at your SDK:
#   sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk
gradle assembleDebug        # → app/build/outputs/apk/debug/app-debug.apk
```

**Web workspace** (self-hosted companion — developed separately): a Next.js
app lives in `web/` locally. Same setup as any Next project:
`cd web && npm install && npx prisma migrate dev && npm run dev`.

## Ground rules

These aren't stylistic preferences — they're product guarantees:

- **No fake integrations or mock data.** No platform publishes a driver
  API — accessibility parsing is what exists, and we say so. Never
  simulate a real connection or seed demo records.
- **Honest claims.** Do not describe accessibility-based reading as a
  platform "integration," and do not promise automation beyond what the
  code actually does.
- **Money is integer cents; distances are kilometers.** Convert for
  display at the edge only.
- **Privacy is a feature.** Screen content never leaves the device; sync
  is opt-in. Don't add telemetry, analytics SDKs, or third-party calls
  without an explicit discussion first.
- **Automation stays opt-in** and cancellable — auto-accept/decline must
  never become default-on.

## Code style

- **Android:** plain Kotlin Views, no Compose/Material dependencies — the
  design system lives in `ui/Ios.kt`. Keep it dependency-free.
- **Web (local workspace):** TypeScript strict, server components for
  reads, Zod at the API boundary.
- Compact code; comment the *why*, not the *what*.

## Pull request checklist

- [ ] `cd android && gradle assembleDebug` builds clean
- [ ] No new dependencies without a reason given in the PR
- [ ] No secrets, tokens, or personal data in code, tests, or fixtures
- [ ] Docs updated if behavior changed

## Fixing a parse miss

Driver apps change their offer-card layouts — this is the most common
failure. When a screen looks like an offer but nothing happens:

1. Open **Assist → Diagnostics** and tap the app — the sheet lists every
   text the assistant read on that screen.
2. Screenshot it (redact personal details) and open an issue, or extend
   `OfferParser.kt` yourself — it works on text patterns, not view IDs, so
   a fix is usually a one-line regex.
3. Test against a real screen; the parser errs toward silence when unsure.

## License

By contributing, you agree your contribution is licensed under the
[MIT License](LICENSE).
