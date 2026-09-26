import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

const sections = [
  {
    h: "What we collect",
    body: "Account information (name, email, password hash), work data you record (trips, deliveries, earnings, expenses, mileage, offers), vehicles, preferences, goals and rules, and technical session data (IP address, user agent) needed to keep your account secure.",
  },
  {
    h: "What we don't collect",
    body: "GigFlow does not continuously track your location. Zones and locations are only stored when you type them into a record. We do not access your platform accounts unless a supported integration is explicitly connected by you.",
  },
  {
    h: "How data is used",
    body: "Your data powers your dashboard, analytics, goals, rules and exports. It is not sold, rented, or shared with third parties for marketing.",
  },
  {
    h: "Integrations",
    body: "Where a platform offers an official integration, credentials are encrypted at rest (AES-256-GCM) and never exposed to the browser. Where no API exists, GigFlow uses manual tracking instead — we never scrape or bypass platform protections.",
  },
  {
    h: "Demo data",
    body: "Demo mode generates clearly-marked sample records. Demo data is fully separated from real data and can be deleted independently.",
  },
  {
    h: "Your controls",
    body: "Export everything as JSON, delete demo data, or delete your entire account — which removes all associated records — from Settings → Data.",
  },
  {
    h: "Contact",
    body: "Privacy questions: privacy@gigflow.app.",
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
