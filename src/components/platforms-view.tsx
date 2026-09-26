"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, Button, Badge, EmptyState } from "@/components/ui/primitives";
import { PageHeader } from "@/components/page-header";
import { PlatformDot } from "@/components/platform-dot";
import { Modal } from "@/components/ui/modal";
import { formatMoney, formatDateTime } from "@/lib/units";
import { api, ApiClientError } from "@/lib/client";
import { RefreshCw, Link2, Unlink, Info } from "lucide-react";

type PlatformRow = {
  id: string; key: string; name: string; category: string;
  status: string; statusNote: string | null; color: string;
  connection: { id: string; status: string; lastSyncAt: string | null; lastError: string | null } | null;
  totalGrossCents: number;
};

function statusBadge(status: string, connected: boolean) {
  if (!connected) {
    if (status === "UNAVAILABLE") return <Badge tone="neutral">Manual only</Badge>;
    if (status === "COMING_SOON") return <Badge tone="neutral">Coming soon</Badge>;
    if (status === "MOCK") return <Badge tone="accent">Demo data</Badge>;
    return <Badge tone="neutral">Not connected</Badge>;
  }
  return null;
}

export function PlatformsView({ platforms, currency }: { platforms: PlatformRow[]; currency: string }) {
  const router = useRouter();
  const money = (c: number) => formatMoney(c, currency);
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState<PlatformRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  };

  const connected = platforms.filter((p) => p.connection);
  const available = platforms.filter((p) => !p.connection);

  return (
    <div className="space-y-5">
      <PageHeader title="Platforms" subtitle="Manage the platforms you work on." />

      {error && <p className="text-sm text-negative" role="alert">{error}</p>}

      {connected.length > 0 && (
        <section aria-label="Connected platforms">
          <h2 className="text-sm font-semibold mb-3">Your platforms</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {connected.map((p) => (
              <Card key={p.id}>
                <CardBody>
                  <div className="flex items-start gap-3">
                    <PlatformDot name={p.name} color={p.color} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{p.name}</p>
                        <Badge tone={p.connection!.status === "CONNECTED" ? "positive" : p.connection!.status === "MOCK" ? "accent" : p.connection!.status === "ERROR" ? "negative" : "neutral"}>
                          {p.connection!.status === "MOCK" ? "Demo" : p.connection!.status === "MANUAL" ? "Manual tracking" : p.connection!.status.toLowerCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted mt-0.5">
                        Lifetime tracked: {money(p.totalGrossCents)}
                      </p>
                      <p className="text-[11px] text-faint mt-0.5">
                        {p.connection!.lastSyncAt
                          ? `Last sync ${formatDateTime(p.connection!.lastSyncAt)}`
                          : p.status === "MOCK" ? "Generates sample data" : "Manual tracking"}
                      </p>
                      {p.connection!.lastError && (
                        <p className="text-[11px] text-negative mt-0.5">{p.connection!.lastError}</p>
                      )}
                    </div>
                    <button onClick={() => setInfo(p)} aria-label={`About ${p.name}`} className="text-faint hover:text-fg p-1"><Info size={15} /></button>
                  </div>
                  <div className="flex gap-2 mt-4">
                    {p.status === "MOCK" && (
                      <Button
                        size="sm" variant="outline" disabled={busy === `sync:${p.id}`}
                        onClick={() => act(`sync:${p.id}`, () => api(`/api/platforms/connections/${p.connection!.id}/sync`, { method: "POST" }))}
                      >
                        <RefreshCw size={13} className={busy === `sync:${p.id}` ? "animate-spin" : ""} /> Sync now
                      </Button>
                    )}
                    <Button
                      size="sm" variant="ghost" disabled={busy === `del:${p.id}`}
                      onClick={() => act(`del:${p.id}`, async () => {
                        if (!confirm(`Remove ${p.name} from your workspace? Your tracked data is kept.`)) return;
                        await api(`/api/platforms/connections/${p.connection!.id}`, { method: "DELETE" });
                      })}
                    >
                      <Unlink size={13} /> Remove
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Available platforms">
        <h2 className="text-sm font-semibold mb-3">{connected.length ? "Add more" : "All platforms"}</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {available.map((p) => (
            <Card key={p.id}>
              <CardBody>
                <div className="flex items-start gap-3">
                  <PlatformDot name={p.name} color={p.color} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{p.name}</p>
                      {statusBadge(p.status, false)}
                    </div>
                    <p className="text-xs text-muted mt-1 leading-relaxed">{p.statusNote}</p>
                  </div>
                </div>
                <div className="mt-4">
                  {p.status === "COMING_SOON" ? (
                    <p className="text-[11px] text-faint">Integration in progress — not yet addable.</p>
                  ) : (
                    <Button
                      size="sm" variant="outline" disabled={busy === p.id}
                      onClick={() => act(p.id, () => api("/api/platforms/connections", { method: "POST", body: { platformId: p.id } }))}
                    >
                      <Link2 size={13} /> {busy === p.id ? "Adding…" : p.status === "MOCK" ? "Enable demo" : p.status === "UNAVAILABLE" ? "Track manually" : "Add platform"}
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
        {available.length === 0 && <EmptyState title="All platforms added" />}
      </section>

      <Modal open={!!info} onClose={() => setInfo(null)} title={info?.name ?? ""}>
        {info && (
          <div className="space-y-3 text-sm">
            <p className="text-muted">{info.statusNote}</p>
            {info.status === "UNAVAILABLE" && (
              <p className="text-muted">
                GigFlow does not pretend to integrate where no official API exists.
                You can still assign earnings, trips and expenses to {info.name}
                manually so your analytics stay complete.
              </p>
            )}
            {info.status === "MOCK" && (
              <p className="text-muted">
                The demo provider generates clearly-marked sample data so you can
                evaluate GigFlow. Demo records never mix with real entries and can
                be removed from Settings → Data.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
