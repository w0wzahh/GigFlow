# GigFlow Driver — Android companion

A native Android app in the iOS design language: dashboard, offer feed,
quick-add tracking, and the offer assistant — all on-device, zero
third-party dependencies (plain Views, no Compose/Material).

## The app

Five tabs behind a floating frosted tab bar:

- **Home** — today's net/gross/hours/$-per-hour plus a full analytics
  section: week/month toggle, per-hour and per-distance rates, platform
  breakdown, daily gross chart, goals, and insights. Pulls live aggregates
  from the web workspace when sync is configured; otherwise computes from
  on-device records.
- **Offers** — the assistant's scored-offer feed: verdict pill (Good /
  Borderline / Skipped), per-distance and per-hour rates, grouped by day,
  filterable by a segmented control; tap a row for full metrics.
- **Plan** — recurring shift blocks with day-of-week picker, start/end
  times, and an optional earnings target; syncs to `/api/mobile/schedule`.
- **Track** — quick-add earnings, expenses, and mileage in grouped iOS
  forms. Everything saves to a local SQLite store first (works offline) and
  pushes to the web app when connected, with `clientId` dedupe so retries
  never double-count.
- **Assistant** — accessibility-service status, Monitoring / Auto-accept /
  Auto-decline switches (both automation switches off by default), offer
  rules, and web sync settings.

## The assistant (Mystro-style, honest version)

- Watches the offer screens of the driver apps you choose (Uber Driver,
  Lyft Driver, Dasher, Instacart Shopper, Amazon Flex, Spark) via
  `AccessibilityService` — scoped by package name, blind to everything else.
- Reads the offer card off the screen (payout, distance, duration,
  accept/decline buttons) with text-pattern parsing — layout-independent.
- Scores against your thresholds and floats a verdict card over the app:
  `GOOD OFFER` / `BORDERLINE` / `SKIP IT` with $/mi, $/hr, and tap shortcuts.
- Optionally taps Accept/Decline via `dispatchGesture` — opt-in switches.
- Pushes each scored offer to `POST /api/mobile/offers` so the web Offers
  feed sees what the phone saw.

## Honest limitations

- **Not an official integration.** No major platform publishes a driver API;
  this reads what's on screen, like every app in this category.
- **Heuristic parsing.** Driver apps change layouts often. If a card can't
  be parsed, nothing is shown — the app errs toward silence and never
  guesses at buttons.
- **Android only.** iOS doesn't permit this class of screen-reading. The
  web app is the iOS-friendly surface; this app is the Android advantage.
- **Automation is opt-in** and only fires when the button was found
  unambiguously.
- **Policy note.** Google Play restricts accessibility services that aren't
  primarily accessibility tools; this app is distributed as an APK. Using
  third-party assistants may conflict with gig platforms' terms — your call.

## Build

JDK 17+ and Android SDK platform 36.

```bash
# local.properties must point at your SDK (gitignored):
#   sdk.dir=C:\\Users\\<you>\\AppData\\Local\\Android\\Sdk
gradle assembleDebug   # → app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Connect to the web app

1. GigFlow web → **Settings → Security → Android companion app → Generate
   token** (shown once, SHA-256 hashed at rest).
2. App → **Assistant → GigFlow sync**: paste the web URL
   (`http://<PC-LAN-IP>:3000` on the same Wi-Fi, or your deployed URL) and
   the token → **Connect**.

The token can push offers/records and read dashboard totals — it cannot
read full history or change account settings. Revoke any time in Settings.

## Data handling

- Screen content never leaves the phone; only distilled fields (payout,
  distance, duration, verdict, action) sync.
- Records save to `gigflow.db` locally first; unsynced rows flush as a
  batch when connectivity returns.
- The token lives in private app storage and is never logged.
