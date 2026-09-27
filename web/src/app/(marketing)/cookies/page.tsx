import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cookie Policy" };

export default function CookiesPage() {
  return (
    <div className="min-h-dvh">
      <header className="h-14 border-b border-border px-4 sm:px-6 flex items-center">
        <Link href="/"><Logo /></Link>
      </header>
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Cookie Policy</h1>
        <p className="text-sm text-faint mt-2">Last updated: September 2026</p>
        <div className="mt-8 space-y-6">
          <section>
            <h2 className="text-base font-semibold">What we use</h2>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              GigFlow sets exactly one cookie: <code className="text-xs bg-card px-1 py-0.5 rounded">gigflow_session</code> —
              a strictly-necessary <code className="text-xs bg-card px-1 py-0.5 rounded">HttpOnly</code>,{" "}
              <code className="text-xs bg-card px-1 py-0.5 rounded">SameSite=Lax</code> session cookie
              (Secure in production) that keeps you signed in for up to 30 days or until sign-out.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold">{"What we don't use"}</h2>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              No analytics cookies, no advertising or tracking cookies, no third-party cookies at all.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold">Your control</h2>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              Because the only cookie is strictly necessary for the service to function, it does not
              require consent under the ePrivacy Directive. You can delete or block it in your browser
              at any time — that simply signs you out.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
