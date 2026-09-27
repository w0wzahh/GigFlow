import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

const sections = [
  {
    h: "What the web app collects",
    body: "Account details (name, email, salted password hash) for sign-in; records you enter or import (earnings, expenses, mileage, trips, deliveries, offers, schedules, goals, rules); session data (hashed token, IP, user agent) for security; and your preferences. Optional Gmail receipt sync stores OAuth tokens encrypted (AES-256-GCM), read-only — we never see your Gmail password.",
  },
  {
    h: "What the Android companion collects",
    body: "The companion is local-first. Its accessibility service reads offer cards inside the driver apps you choose — raw screen content is processed on-device and never transmitted; only distilled fields (payout, distance, duration, verdict, action) are kept in a capped local log. GPS breadcrumbs are recorded only while a shift is active and only for the work heatmap; they never leave the device except through sync you configure yourself.",
  },
  {
    h: "What we never do",
    body: "No advertising, no analytics SDKs, no tracking pixels, no data sale. No continuous location tracking, no scraping of platform accounts, no access to apps outside the ones you explicitly watch.",
  },
  {
    h: "Cookies",
    body: "One strictly-necessary session cookie (HttpOnly, SameSite=Lax) keeps you signed in — no analytics, advertising or third-party cookies. See the Cookie Policy at /cookies.",
  },
  {
    h: "Retention and deletion",
    body: "Data is kept while your account exists. Export everything as JSON or delete your account — removing all records — from Settings → Data. Android local data is removed by clearing app storage or uninstalling.",
  },
  {
    h: "Security",
    body: "Salted scrypt password hashing, hashed session tokens, per-user scoping on every query, rate-limited auth endpoints, AES-256-GCM for integration credentials. Report vulnerabilities via GitHub Security Advisories on the repository.",
  },
  {
    h: "Your rights",
    body: "Depending on jurisdiction (GDPR in the EU/UK, CCPA in California) you may have rights to access, correct, export or delete your data. The export and delete tools satisfy most of these directly. Self-hosted deployments: whoever runs the instance is the data controller, not the upstream project.",
  },
  {
    h: "Children",
    body: "The Service is for adults legally able to perform gig work (18+). We do not knowingly collect data from children.",
  },
  {
    h: "Changes and contact",
    body: "Material changes are committed to the repository and noted in release notes. Questions or requests: github.com/w0wzahh/GigFlow/issues — include the account email for data requests. Canonical text: docs/legal/privacy-policy.md.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh">
      <header className="h-14 border-b border-border px-4 sm:px-6 flex items-center">
        <Link href="/"><Logo /></Link>
      </header>
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-faint mt-2">Last updated: September 2026</p>
        <div className="mt-8 space-y-6">
          {sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-base font-semibold">{s.h}</h2>
              <p className="text-sm text-muted mt-1.5 leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
