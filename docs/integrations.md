# Integration Architecture

## The honest constraint

GigFlow's value depends on platform data — but as of September 2026, **none of
the major gig platforms offer a public driver-facing API** for earnings, trip
history, or offer streams:

- **Uber / Uber Eats**: no public driver data API; Uber's APIs cover business
  accounts and ride ordering, not driver earnings.
- **Lyft**: no public driver API.
- **DoorDash**: the Drive API is for merchants dispatching deliveries, not for
  Dashers' own data.
- **Instacart, Grubhub, Amazon Flex, Walmart Spark**: no public worker-data APIs.

We do not scrape, reverse-engineer, or automate platform apps — that violates
their terms and puts drivers' accounts at risk.

## How automation apps actually do it

Products like **Mystro** are frequently mistaken for API integrations. They are
not: Mystro is an **Android app that uses the Accessibility Service** to read
offer cards rendered on-screen by the Uber/Lyft driver apps and to simulate taps
(accept/decline, online/offline) inside those apps. It runs entirely on-device.
This approach:

- requires a native Android app — not possible in a web platform;
- is restricted on iOS, where apps cannot observe or drive other apps;
- has been criticized by Google as a misuse of accessibility APIs;
- automating another app's UI can conflict with that platform's terms.

GigFlow ships its own companion for this — see **Android companion** below.

Products like **Gridwise** sync earnings by storing your platform credentials
and logging in as you server-side — brittle (connections break often) and a
terms-of-service gray area. GigFlow does **not** store platform passwords.

## What GigFlow implements instead

Four real, user-controlled data paths — nothing simulated:

### 1. CSV statement import (`src/lib/import.ts`)

Every major platform lets drivers download earnings/payment exports. The
importer accepts any of these plus generic CSVs:

- Auto-detects the header row and date/amount/tip/bonus/reference/distance/
  duration columns by name (`Your earnings`, `Trip fare`, `Tips`, `Trip ID`, …)
- Parses `$1,234.56`, `(12.50)`, `-4.00`, `MM/DD/YYYY`, ISO dates
- Converts miles→km when the column header says `miles`/`mi`
- Generates a stable `importKey` per row (sha256 of platform + row reference)
  so re-importing the same file is a no-op
- Creates `Earning` rows with `source: "IMPORT"`

### 2. Gmail receipt sync (`src/lib/integrations/gmail.ts`)

Uber and Lyft email a per-trip receipt to drivers. With the user's explicit
OAuth consent (`gmail.readonly`, revocable from Google Account settings):

- `GET /api/integrations/gmail/authorize` → Google OAuth (HMAC-signed, expiring
  `state` parameter)
- `…/callback` → exchanges the code, stores access/refresh tokens **encrypted
  at rest (AES-256-GCM)** on `Account`
- `POST /api/integrations/gmail` → lists `from:` known receipt senders, parses
  labeled amounts ("Total", "You earned", "Tip") with a largest-figure
  fallback, dedupes on `importKey = gmail:<messageId>`
- Tokens never reach the browser. If `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
  are not configured, the UI shows "Needs setup" — the feature is hidden, not
  faked.

### 3. Manual tracking

Every platform in the catalog is trackable manually. Connections on
manual-only platforms get status `MANUAL` — the UI says "Manual tracking",
never "Connected".

### 4. Android companion (`android/`)

`GigFlow Driver` is a native Kotlin app using `AccessibilityService` — the
same class of API as Mystro — with no third-party dependencies:

- `OfferParser.kt` reads offer cards (payout, distance, duration,
  accept/decline affordances) from the driver apps' view trees using textual
  patterns, not view IDs
- `RuleEngine.kt` scores offers locally ($/mi, $/hr, payout floor, max
  distance) — same semantics as `src/lib/rules/engine.ts`
- `OverlayController.kt` floats a verdict card over the driver app using a
  `TYPE_ACCESSIBILITY_OVERLAY` window (no `SYSTEM_ALERT_WINDOW` permission)
- `GesturePerformer.kt` taps accept/decline via `dispatchGesture` — only when
  the user enabled the corresponding switch
- `GigFlowApi.kt` pushes distilled offer fields (never screen content) to
  `POST /api/mobile/offers`, authenticated by a per-user bearer token whose
  SHA-256 hash is stored on `User.mobileTokenHash`
- Tokens are generated/revoked in Settings → Security; pushed offers land in
  the Offers feed with `source: "COMPANION"`

Caveats: driver-app layouts change, parsing is heuristic, automation is
opt-in only, and Google Play policy restricts accessibility services that
aren't assistive tools — the APK is sideloaded. See `android/README.md`.

## Catalog statuses

| Status | Meaning |
|---|---|
| `IMPORT` | Official statement exports exist and GigFlow parses them |
| `MANUAL` | No API/export pipeline — manual tracking only |
| `COMING_SOON` | An integration is designed and in progress |
| `UNAVAILABLE` | Confirmed no viable integration path today |

## Adding a real provider API

If a platform launches an official driver-facing API:

1. `src/lib/integrations/<name>.ts` — implement `PlatformIntegration`:
   `authenticate`, `disconnect`, `sync`, `getDriverStatus`, `getTrips`,
   `getEarnings`, `getOffers?`
2. `registerAdapter()` in `registry.ts`, set `adapterKey` on the catalog row.
3. Credentials stay server-side, encrypted (`lib/crypto.ts`), and are never
   returned by the API or included in exports.

## Environment variables

| Variable | Purpose |
|---|---|
| `APP_URL` | Base URL, used for the Google OAuth redirect URI |
| `APP_SECRET` | Derives the AES-256 key for token encryption + OAuth state signing |
| `GOOGLE_CLIENT_ID` | Google OAuth client (Gmail sync) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret (Gmail sync) |
