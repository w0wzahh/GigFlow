import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/primitives";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Status" };

export default function StatusPage() {
  return (
    <div className="min-h-dvh">
      <header className="h-14 border-b border-border px-4 sm:px-6 flex items-center">
        <Link href="/"><Logo /></Link>
      </header>
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Status</h1>
        <div className="mt-8 rounded-xl border border-border bg-elevated p-5 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-positive" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">All systems operational</p>
            <p className="text-xs text-muted mt-0.5">Self-hosted instance — this page reflects static configuration, not live monitoring.</p>
          </div>
          <Badge tone="positive" className="ml-auto">Healthy</Badge>
        </div>
      </main>
    </div>
  );
}
