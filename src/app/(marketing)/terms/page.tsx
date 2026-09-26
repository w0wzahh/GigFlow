import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

const sections = [
  {
    h: "The service",
    body: "GigFlow is a workspace for gig workers to record and analyze earnings, expenses, mileage and work opportunities. GigFlow is an independent product and is not affiliated with, endorsed by, or partnered with Uber, Lyft, DoorDash, Uber Eats, Instacart, Grubhub, Amazon, or any other platform.",
  },
  {
    h: "Your account",
    body: "You are responsible for your credentials and for the accuracy of data you record. You must be legally permitted to work on the platforms you track.",
  },
  {
    h: "No automation on third-party platforms",
    body: "GigFlow evaluates and labels offers based on rules you define. It does not accept, decline, or interact with third-party platforms on your behalf, and it never circumvents platform security or terms.",
  },
  {
    h: "Not financial advice",
    body: "Metrics, profit estimates, and insights are informational calculations from your data. GigFlow is not tax, accounting, or financial advice.",
  },
  {
    h: "Availability",
    body: "The service is provided as-is during early access. We aim for reliability but make no uptime guarantees.",
  },
  {
    h: "Termination",
    body: "You may delete your account at any time from Settings → Data. We may suspend accounts that abuse the service.",
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-dvh">
      <header className="h-14 border-b border-border px-4 sm:px-6 flex items-center">
        <Link href="/"><Logo /></Link>
      </header>
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
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
