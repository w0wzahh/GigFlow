# GigFlow Privacy Policy

**Last updated: September 2026**

GigFlow exists to help gig workers keep and understand their own work data.
This policy explains what is collected, where it lives, and the control you
have over it. The short version: **your data is yours, the app works
locally first, and nothing is sent anywhere unless you configure it.**

## 1. What the web app collects

| Data | Why |
|---|---|
| Account details — name, email, salted password hash | Sign-in and account recovery |
| Records you enter or import — earnings, expenses, mileage, trips, deliveries, offers, schedules, goals, rules | The core service: dashboards, analytics, planning |
| Session data — session token (stored hashed), IP address, user agent | Security, abuse prevention, keeping you signed in |
| Preferences — units, notification settings | To make the app behave the way you set it |

If you connect the optional **Gmail receipt sync**, OAuth tokens are stored
encrypted (AES-256-GCM) and used read-only to find trip-receipt emails.
We never see your Gmail password and cannot send mail.

## 2. What the Android companion collects

The companion app is **local-first**:

- **Screen content:** the accessibility service reads offer cards inside
  the driver apps you choose (Uber, Lyft, Dasher, Instacart, Amazon Flex,
  Spark, Wolt, foodora). Raw screen content is processed on-device and is
  never transmitted. Only distilled fields — payout, distance, duration,
  verdict, action taken — are kept, in a capped on-device log.
- **Location:** only while an active shift is running (started by you, or
  automatically if you enable auto-tracking) the app records GPS
  breadcrumbs to a local database. The work heatmap is built from these
  points. Location is never collected in the background outside a shift
  and is never sent off-device except through sync you configure.
- **Sync:** if you paste your web URL and a personal API token, the app
  pushes distilled offer fields and your logged records to your GigFlow
  account. If you never configure sync, nothing leaves the phone.

## 3. What we do not do

- No advertising, no analytics SDKs, no tracking pixels, no data sale.
- No continuous location tracking; no scraping of platform accounts; no
  access to apps outside the ones you explicitly watch.

## 4. Cookies

The web app uses one strictly-necessary session cookie (`HttpOnly`,
`SameSite=Lax`). There are no analytics, advertising, or third-party
cookies. See [Cookie Policy](cookie-policy.md).

## 5. Retention and deletion

Your data is kept while your account exists. Export everything as JSON, or
delete your account — which removes all associated records — from
**Settings → Data**. Local app data on Android is removed when you clear
app storage or uninstall.

## 6. Security

Salted scrypt password hashing, hashed session tokens, per-user scoping on
every query, rate-limited auth endpoints, and encrypted integration
credentials. Details: [SECURITY.md](../../SECURITY.md). No system is
perfect — report vulnerabilities via GitHub Security Advisories.

## 7. Your rights

Depending on your jurisdiction (including GDPR in the EU/UK and CCPA in
California) you may have rights to access, correct, export, or delete your
data, and to object to processing. The export and account-delete tools
satisfy most of these directly; for anything else, open an issue or
contact the maintainer.

Self-hosted deployments: whoever runs your instance is the data
controller, not the upstream project.

## 8. Children

The Service is for adults legally able to perform gig work (18+). We do
not knowingly collect data from children.

## 9. Changes

Material changes are committed to this repository and noted in release
notes; the "Last updated" date above reflects the current version.

## Contact

Privacy questions or requests:
<https://github.com/w0wzahh/GigFlow/issues> (for account-data requests,
include the email on the account).
