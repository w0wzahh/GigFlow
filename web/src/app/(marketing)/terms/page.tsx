import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

const sections = [
  {
    h: "1. What GigFlow is",
    body: "GigFlow is a workspace for rideshare and delivery workers: record earnings, expenses and mileage; evaluate offers against rules you define; plan your schedule; review analytics from your own data. GigFlow is an independent project — not affiliated with, endorsed by, or partnered with Uber, Lyft, DoorDash, Wolt, foodora, Instacart, Amazon, Walmart or any other platform. Platform names are trademarks of their owners, used only to identify compatibility.",
  },
  {
    h: "2. Eligibility and your account",
    body: "You must be at least 18 and legally permitted to perform gig work on the platforms you track. You are responsible for your credentials and API tokens, for all activity under your account, and for the accuracy of data you record or import.",
  },
  {
    h: "3. Third-party platforms",
    body: "GigFlow is a read-and-record tool, not a source of work — it does not grant access to any platform, guarantee offers, or affect your standing. The Android companion can, only at your explicit direction, read offer cards on-screen via Android accessibility APIs and perform accept/decline gestures inside the driver apps you select, including a countdown-based auto-accept. Enabling these features means: you have the right to use assistive tooling on your device; you accept that automation may conflict with a platform's own terms and that platforms may act against your account — that risk is entirely yours; and you remain responsible for every action taken at your direction, including automatically accepted offers. We never circumvent technical protections or access platform accounts. Offer detection is heuristic and can misread or miss data.",
  },
  {
    h: "4. Acceptable use",
    body: "Don't use the Service for anything unlawful, to defraud any platform, customer or tax authority, to access other users' data, to disrupt the Service, or to fabricate records for deceptive purposes. Don't commercially rehost the hosted Service without permission.",
  },
  {
    h: "5. Your data",
    body: "You own the data you record. We claim no rights beyond storing and processing it to serve you. Export everything as JSON or delete your entire account — and all records — from Settings → Data. In the Android app, offer scoring and GPS breadcrumbs are processed on-device and reach our servers only through sync you configure.",
  },
  {
    h: "6. No professional advice",
    body: "Per-hour and per-distance earnings, profit estimates, mileage totals and insights are informational calculations from your data — not tax, accounting, financial or legal advice. Mileage figures are estimates; keep your own records for tax purposes.",
  },
  {
    h: "7. Availability and changes",
    body: "The Service is provided as-is and as-available, with no uptime guarantee. We may update these Terms; material changes are announced in release notes and continued use constitutes acceptance.",
  },
  {
    h: "8. Limitation of liability",
    body: "To the maximum extent permitted by law: no warranties of any kind; no liability for indirect or consequential damages — including lost income, lost data, account actions taken by gig platforms, or offers missed or mis-scored; aggregate liability capped at what you paid in the prior twelve months (zero for the free service). Nothing excludes liability that cannot be excluded by law.",
  },
  {
    h: "9. Termination",
    body: "Delete your account any time in Settings → Data. We may suspend accounts that violate these Terms or abuse the Service. Liability and disclaimer sections survive termination.",
  },
  {
    h: "10. Governing law",
    body: "Unless your local consumer-protection law requires otherwise, these Terms are governed by the law of the maintainer's jurisdiction. Mandatory consumer rights (including under EU/UK law) are unaffected.",
  },
  {
    h: "Contact",
    body: "Questions: open an issue at github.com/w0wzahh/GigFlow. The canonical text of these Terms also lives in the repository at docs/legal/terms-of-service.md.",
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
