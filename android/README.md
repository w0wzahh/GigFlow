# GigFlow Driver — Android companion

A native Android app that scores gig offers **on-device** using Android's
`AccessibilityService`, the same class of API Mystro-style assistants use.
No root, no SDK hooks into the driver apps themselves.

## What it does

- Watches the offer screens of the driver apps you choose (Uber Driver,
  Lyft Driver, Dasher, Instacart Shopper, Amazon Flex, Spark).
- Reads the offer card off the screen: payout, distance, duration, and the
  accept/decline buttons.
- Scores the offer against **your thresholds** ($/mile, $/hour, minimum
  payout, max distance) and shows a floating verdict card:
  `GOOD OFFER` / `BORDERLINE` / `SKIP IT` with $/mi and $/hr.
- Optionally taps **Accept** or **Decline** for you — off by default, two
  separate opt-in switches.
- Keeps a rolling on-device log of the last 200 offers.
- Optionally pushes each scored offer to your GigFlow web workspace, so the
  Offers page and analytics include what the phone saw.

## Honest limitations

- **Not an official integration.** Uber/Lyft/DoorDash do not publish driver
  APIs; this reads what's on screen, like every app in this category.
- **Text-pattern parsing.** Driver apps change their layouts often. If a
  card can't be parsed, nothing is shown — the app errs toward silence, and
  never guesses at buttons.
- **Android only.** iOS does not permit this class of screen-reading.
- **Automation is opt-in.** Auto-accept/auto-decline only fire when you turn
  the switches on, and only when the offer's button was found unambiguously.
- **Policy note.** Google Play restricts accessibility services that aren't
  primarily accessibility tools; this app is distributed as an APK, not via
  Play. Using third-party assistants may conflict with gig platforms' terms —
  you are responsible for that choice.

## Build

Requires JDK 17+ and the Android SDK (platform 36).

```bash
# local.properties must point at your SDK:
#   sdk.dir=C:\\Users\\<you>\\AppData\\Local\\Android\\Sdk
gradle assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```

Install on a phone over USB:

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

## Setup on the phone

1. Install the APK and open **GigFlow Driver**.
2. Tap **Enable in Accessibility settings**, find **GigFlow Offer
   Assistant**, turn it on.
3. Set your thresholds and save.
4. (Optional) leave **Auto-accept** / **Auto-decline** off to just get the
   score card; turn them on for automation.

## Connect to the web app

1. In the GigFlow web app: **Settings → Security → Android companion app →
   Generate token**. Copy it (shown once).
2. In the phone app: paste the web app URL (e.g. `http://192.168.x.x:3000`
   on the same LAN, or your deployed URL) and the token → **Save sync**.

Every scored offer then appears in the web app's Offers feed with
`source: COMPANION`, evaluated against your web-side rules too.

## Data handling

- Screen content never leaves the phone. Only the distilled fields
  (payout, distance, duration, verdict, action) are sent when sync is on.
- The sync token is stored in private app storage and never logged.
- The token can only *create* offer records — it cannot read your data.
  Revoke it any time in Settings → Security.
