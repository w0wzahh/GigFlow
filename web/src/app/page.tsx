import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/primitives";
import { PLATFORM_CATALOG } from "@/lib/catalog";
import {
  Wallet, Blocks, Zap, Gauge, Receipt, CalendarDays, BarChart3,
  SlidersHorizontal, Bell, ArrowRight, Check,
} from "lucide-react";

const features = [
  { icon: Wallet, title: "Earnings tracking", body: "Log trips, deliveries, tips, bonuses and adjustments across every platform — see gross and net in one place." },
  { icon: Blocks, title: "Multi-platform workspace", body: "Track work across rideshare and delivery platforms with a single, unified activity timeline." },
  { icon: Zap, title: "Offer intelligence", body: "Score incoming offers with $/mile, $/hour and estimated profit before you accept." },
  { icon: Gauge, title: "Mileage tracking", body: "Record work vs. personal miles per vehicle, ready for tax time." },
  { icon: Receipt, title: "Expenses", body: "Fuel, charging, maintenance, insurance, tolls and more — categorized and exportable." },
  { icon: CalendarDays, title: "Work planner", body: "Plan working hours, zones and target earnings on a weekly schedule." },
  { icon: BarChart3, title: "Performance analytics", body: "Per-hour and per-mile trends, platform comparisons, and period-over-period deltas." },
  { icon: SlidersHorizontal, title: "Smart rules", body: "Define what a good offer looks like — GigFlow labels every incoming offer against your rules." },
  { icon: Bell, title: "Notifications", body: "Milestones, goal progress, sync failures and account events — configurable per category." },
];

const steps = [
  { n: "1", title: "Create your account", body: "Sign up, set your currency, units and the platforms you drive for." },
  { n: "2", title: "Track your work", body: "Log trips, deliveries, expenses and mileage — or import an earnings statement to fill in history." },
  { n: "3", title: "Set your rules", body: "Tell GigFlow what a worthwhile offer looks like: minimum $/mile, $/hour, payout." },
  { n: "4", title: "Optimize", body: "Use analytics and goal tracking to work the hours, zones and platforms that pay best." },
];

const faqs = [
  {
    q: "Which platforms does GigFlow support?",
    a: "GigFlow lets you track work from any platform — Uber, Lyft, DoorDash, Uber Eats, Instacart, Grubhub, Amazon Flex and others — through manual logging. Automatic sync depends on each platform offering a suitable API; where none exists, we say so honestly instead of pretending.",
  },
  {
    q: "Does GigFlow connect directly to Uber or DoorDash?",
    a: "Not today. Most gig platforms do not provide public APIs for driver-facing data. GigFlow is architected around a clean adapter interface so official integrations can be added if and when platforms offer them.",
  },
  {
    q: "Does GigFlow accept or decline offers for me?",
    a: "No. GigFlow evaluates offers against rules you define and labels them — the decision is always yours. We never interact with a third-party platform on your behalf.",
  },
  {
    q: "What happens to my data?",
    a: "Your data is yours. You can export everything as JSON at any time, or delete your account — which removes all associated records. We don't sell or share your data.",
  },
  {
    q: "Can I try it without connecting anything?",
    a: "Yes — GigFlow works entirely with data you control. Log work manually, import a CSV statement exported from your platform's driver portal, or sync Gmail receipts. No platform credentials required.",
  },
  {
    q: "How much does it cost?",
    a: "GigFlow's core tracking is free. Paid tiers with advanced analytics and automation are planned — early users keep free access to what they already use.",
  },
];

export default function LandingPage() {
  const connectable = PLATFORM_CATALOG.filter((p) => p.status !== "UNAVAILABLE" && p.key !== "other");
  const manual = PLATFORM_CATALOG.filter((p) => p.status === "UNAVAILABLE" || p.key === "other");

  return (
    <div className="min-h-dvh">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border glass">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted">
            <a href="#features" className="hover:text-fg">Features</a>
            <a href="#platforms" className="hover:text-fg">Platforms</a>
            <a href="#pricing" className="hover:text-fg">Pricing</a>
            <a href="#faq" className="hover:text-fg">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link href="/register"><Button size="sm">Get Started</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-14 sm:pt-24 sm:pb-20 text-center">
          <p className="inline-flex items-center gap-2 text-xs font-medium text-accent bg-accent-soft rounded-full px-3 py-1 mb-6 animate-fade-up">
            <Zap size={12} /> One workspace for every gig platform
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl mx-auto text-balance animate-fade-up" style={{ animationDelay: "80ms" }}>
            Your gig work. <span className="text-accent">One flow.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted max-w-xl mx-auto text-balance animate-fade-up" style={{ animationDelay: "160ms" }}>
            GigFlow brings rideshare and delivery work into a single workspace —
            track earnings, expenses and mileage, evaluate every offer, and see
            what your time is really worth.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap animate-fade-up" style={{ animationDelay: "240ms" }}>
            <Link href="/register"><Button size="lg">Get Started <ArrowRight size={16} /></Button></Link>
            <a href="#how"><Button size="lg" variant="outline">See How It Works</Button></a>
          </div>

          {/* Dashboard preview */}
          <div className="mt-14 mx-auto max-w-4xl rounded-2xl border border-border bg-elevated shadow-[var(--shadow-raised)] overflow-hidden text-left animate-fade-up transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-[1.01]" aria-hidden="true" style={{ animationDelay: "340ms" }}>
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border">
              <span className="w-2.5 h-2.5 rounded-full bg-border-strong" />
              <span className="w-2.5 h-2.5 rounded-full bg-border-strong" />
              <span className="w-2.5 h-2.5 rounded-full bg-border-strong" />
              <span className="ml-3 text-[11px] text-faint">app.gigflow — dashboard</span>
            </div>
            <div className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ["Today", "$186.40"], ["This week", "$742.10"], ["$/hour", "$27.30"], ["$/mile", "$1.94"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-subtle/70 p-3.5">
                  <p className="text-[11px] font-medium text-muted">{k}</p>
                  <p className="text-lg sm:text-xl font-bold tabular-nums mt-1">{v}</p>
                </div>
              ))}
              <div className="col-span-2 sm:col-span-3 rounded-xl bg-subtle/70 p-3.5">
                <p className="text-[11px] font-medium text-muted mb-2">Earnings — last 14 days <span className="text-faint">(illustration)</span></p>
                <svg viewBox="0 0 300 60" className="w-full h-14" preserveAspectRatio="none">
                  <path d="M0 48 L25 40 L50 44 L75 30 L100 36 L125 22 L150 28 L175 18 L200 24 L225 14 L250 20 L275 10 L300 14" fill="none" stroke="var(--accent)" strokeWidth="2" />
                  <path d="M0 48 L25 40 L50 44 L75 30 L100 36 L125 22 L150 28 L175 18 L200 24 L225 14 L250 20 L275 10 L300 14 L300 60 L0 60 Z" fill="var(--accent)" opacity="0.12" />
                </svg>
              </div>
              <div className="col-span-2 sm:col-span-1 rounded-xl bg-subtle/70 p-3.5">
                <p className="text-[11px] font-medium text-muted mb-1.5">Weekly goal</p>
                <p className="text-sm font-bold tabular-nums">$742 / $1,000</p>
                <div className="h-2 rounded-full bg-border mt-2.5"><div className="h-full w-[74%] rounded-full bg-accent" /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section id="platforms" className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center">Connect your supported gig platforms</h2>
          <p className="text-muted text-sm sm:text-base text-center mt-3 max-w-2xl mx-auto">
            GigFlow works with any platform through manual tracking today. Automatic sync is added per-platform where an official API exists — and clearly marked where it does not.
          </p>
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[...connectable, ...manual].map((p, i) => (
              <div
                key={p.key}
                className="rounded-2xl border border-border bg-elevated shadow-[var(--shadow-card)] p-3.5 flex items-center gap-3 animate-fade-up transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-[var(--shadow-raised)] hover:-translate-y-0.5"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span
                  className="w-9 h-9 rounded-xl text-white text-xs font-bold inline-flex items-center justify-center shrink-0 shadow-[var(--shadow-card)]"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-[11px] text-faint">
                    {p.status === "IMPORT" ? "Statement import" : p.status === "COMING_SOON" ? "Coming soon" : "Manual tracking"}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-faint mt-6">
            GigFlow is an independent product and is not affiliated with or endorsed by these platforms.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center">Everything in one place</h2>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-elevated shadow-[var(--shadow-card)] p-5 animate-fade-up transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-[var(--shadow-raised)] hover:-translate-y-0.5"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <span className="w-9 h-9 rounded-xl bg-accent-soft text-accent inline-flex items-center justify-center">
                  <f.icon size={18} />
                </span>
                <h3 className="text-sm font-semibold mt-3">{f.title}</h3>
                <p className="text-sm text-muted mt-1.5 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center">How it works</h2>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((s, i) => (
              <div key={s.n} className="rounded-2xl border border-border bg-elevated shadow-[var(--shadow-card)] p-5 animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="w-7 h-7 rounded-full bg-accent text-accent-fg text-xs font-bold inline-flex items-center justify-center shadow-[var(--shadow-card)]">{s.n}</span>
                <h3 className="text-sm font-semibold mt-3">{s.title}</h3>
                <p className="text-sm text-muted mt-1.5 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center">Simple pricing</h2>
          <p className="text-muted text-sm text-center mt-3">Free while GigFlow is in early access.</p>
          <div className="mt-10 grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              {
                name: "Starter", price: "$0", note: "Free forever",
                items: ["Earnings, expenses & mileage tracking", "All platforms via manual logging", "Dashboard & basic analytics", "Data export"],
                cta: "Get Started", primary: true,
              },
              {
                name: "Driver", price: "—", note: "Planned",
                items: ["Everything in Starter", "Smart offer rules", "Advanced analytics & comparisons", "Goal tracking & notifications"],
                cta: "Coming soon", primary: false,
              },
              {
                name: "Pro", price: "—", note: "Planned",
                items: ["Everything in Driver", "Platform sync integrations", "Automation & recommendations", "Priority support"],
                cta: "Coming soon", primary: false,
              },
            ].map((t) => (
              <div key={t.name} className={`rounded-2xl border p-6 bg-elevated shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-200 hover:shadow-[var(--shadow-raised)] ${t.primary ? "border-accent ring-1 ring-accent/20" : "border-border"}`}>
                <h3 className="text-sm font-semibold">{t.name}</h3>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{t.price}</p>
                <p className="text-xs text-faint mt-1">{t.note}</p>
                <ul className="mt-4 space-y-2">
                  {t.items.map((i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted"><Check size={15} className="text-accent shrink-0 mt-0.5" />{i}</li>
                  ))}
                </ul>
                <div className="mt-6">
                  {t.primary ? (
                    <Link href="/register"><Button className="w-full">{t.cta}</Button></Link>
                  ) : (
                    <Button className="w-full" variant="outline" disabled>{t.cta}</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center">Frequently asked questions</h2>
          <div className="mt-10 space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="rounded-2xl border border-border bg-elevated shadow-[var(--shadow-card)] px-5 py-4 group transition-[box-shadow] duration-200 open:shadow-[var(--shadow-raised)]">
                <summary className="text-[15px] font-medium cursor-pointer list-none flex justify-between items-center gap-3">
                  {f.q}
                  <span className="w-6 h-6 rounded-full bg-subtle text-faint inline-flex items-center justify-center shrink-0 group-open:rotate-45 transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] text-sm leading-none">+</span>
                </summary>
                <p className="text-sm text-muted mt-3 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 grid sm:grid-cols-4 gap-8">
          <div>
            <Logo />
            <p className="text-xs text-muted mt-3 max-w-xs">The workspace for rideshare and delivery drivers.</p>
          </div>
          {[
            { h: "Product", links: [["Features", "#features"], ["Pricing", "#pricing"], ["Platforms", "#platforms"]] },
            { h: "Resources", links: [["Documentation", "/docs"], ["Status", "/status"], ["Contact", "mailto:support@gigflow.app"]] },
            { h: "Legal", links: [["Privacy", "/privacy"], ["Terms", "/terms"], ["Cookies", "/cookies"]] },
          ].map((col) => (
            <div key={col.h}>
              <p className="text-xs font-semibold uppercase tracking-wider text-faint">{col.h}</p>
              <ul className="mt-3 space-y-2">
                {col.links.map(([label, href]) => (
                  <li key={label}><a href={href} className="text-sm text-muted hover:text-fg">{label}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-5 text-xs text-faint flex flex-wrap gap-2 justify-between">
            <span>© {new Date().getFullYear()} GigFlow</span>
            <span>Independent product. Not affiliated with Uber, Lyft, DoorDash, Instacart, Grubhub or Amazon.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
