"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, Button, Badge, EmptyState, Field, Input, Select } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/page-header";
import { PlatformDot } from "@/components/platform-dot";
import { formatMoney, formatDateTime, kmToUnit, unitLabel } from "@/lib/units";
import { api, ApiClientError } from "@/lib/client";
import type { OfferMetrics } from "@/lib/rules/engine";
import { Plus, Zap } from "lucide-react";

type OfferRow = {
  id: string;
  platform: { id: string; name: string; color: string; key: string } | null;
  pickup: string | null; destination: string | null;
  estDistanceKm: number; estDurationMin: number;
  payoutCents: number; tipCents: number; estExpensesCents: number;
  status: string; evalLabel: string | null; source: string;
  receivedAt: string;
  metrics: OfferMetrics;
};

const STATUS_TONE: Record<string, "neutral" | "positive" | "negative" | "accent" | "warning"> = {
  PENDING: "warning", ACCEPTED: "positive", DECLINED: "negative", EXPIRED: "neutral",
};

export function OffersView({
  offers, platforms, currency, distanceUnit,
}: {
  offers: OfferRow[];
  platforms: { id: string; name: string }[];
  currency: string; distanceUnit: "MI" | "KM";
}) {
  const router = useRouter();
  const money = (c: number) => formatMoney(c, currency);
  const dist = (km: number) => `${kmToUnit(km, distanceUnit).toFixed(1)} ${unitLabel(distanceUnit)}`;
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("ALL");

  const addOffer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api("/api/offers", {
        method: "POST",
        body: {
          platformId: fd.get("platformId") || null,
          pickup: fd.get("pickup") || null,
          destination: fd.get("destination") || null,
          estDistanceKm: distanceUnit === "MI" ? Number(fd.get("distance")) * 1.609344 : Number(fd.get("distance") || 0),
          estDurationMin: Number(fd.get("duration") || 0),
          payoutCents: Math.round(Number(fd.get("payout") || 0) * 100),
          tipCents: Math.round(Number(fd.get("tip") || 0) * 100),
        },
      });
      setAddOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save.");
    } finally {
      setLoading(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    await api(`/api/offers/${id}`, { method: "PATCH", body: { status } });
    router.refresh();
  };

  const filtered = filter === "ALL" ? offers : offers.filter((o) => o.status === filter);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Offers"
        subtitle="Evaluate incoming work against your rules. GigFlow scores offers — you decide."
        actions={<Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} /> Log offer</Button>}
      />

      <div className="segmented flex-wrap" role="tablist" aria-label="Filter offers">
        {["ALL", "PENDING", "ACCEPTED", "DECLINED", "EXPIRED"].map((s) => (
          <button
            key={s} role="tab" aria-selected={filter === s} onClick={() => setFilter(s)}
            className={`px-3.5 h-8 text-[13px] font-medium transition-colors ${
              filter === s ? "bg-elevated text-fg shadow-[var(--shadow-card)]" : "text-muted hover:text-fg"
            }`}
          >
            {s === "ALL" ? "All" : s[0] + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card><CardBody>
          <EmptyState
            icon={<Zap size={26} />}
            title="No offers"
            body="Log an incoming offer to see its $/mile, $/hour and profit estimate scored against your rules."
            action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} /> Log offer</Button>}
          />
        </CardBody></Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((o) => (
            <Card key={o.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {o.platform && <PlatformDot name={o.platform.name} color={o.platform.color} size={28} />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {o.pickup ?? "Pickup"} → {o.destination ?? "Dropoff"}
                      </p>
                      <p className="text-[11px] text-faint">
                        {o.platform?.name ?? "Unknown"} · {formatDateTime(o.receivedAt)}
                        {o.source === "IMPORT" && <Badge tone="accent" className="ml-1.5">import</Badge>}
                        {o.source === "SYNC" && <Badge tone="accent" className="ml-1.5">sync</Badge>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge tone={STATUS_TONE[o.status] ?? "neutral"}>{o.status.toLowerCase()}</Badge>
                    {o.evalLabel && <Badge tone="accent">{o.evalLabel}</Badge>}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                  {[
                    ["Payout", money(o.payoutCents + o.tipCents)],
                    [`/${distanceUnit === "MI" ? "mi" : "km"}`, o.metrics.earningsPerKmCents != null
                      ? money(distanceUnit === "MI" ? Math.round(o.metrics.earningsPerKmCents * 1.609344) : o.metrics.earningsPerKmCents)
                      : "—"],
                    ["/hour", o.metrics.earningsPerHourCents != null ? money(o.metrics.earningsPerHourCents) : "—"],
                    ["Est. profit", money(o.metrics.profitCents)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-subtle/60 py-2">
                      <p className="text-[10px] text-faint">{k}</p>
                      <p className="text-sm font-semibold tabular-nums mt-0.5">{v}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-faint mt-2">
                  {dist(o.estDistanceKm)} · ~{Math.round(o.estDurationMin)} min · est. expenses {money(o.estExpensesCents)}
                </p>

                {o.status === "PENDING" && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setStatus(o.id, "ACCEPTED")}>Accepted</Button>
                    <Button size="sm" variant="ghost" className="flex-1" onClick={() => setStatus(o.id, "DECLINED")}>Declined</Button>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Log an offer" wide>
        <form onSubmit={addOffer} className="space-y-4">
          <Field label="Platform">
            <Select name="platformId"><option value="">—</option>{platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pickup"><Input name="pickup" placeholder="Downtown" /></Field>
            <Field label="Destination"><Input name="destination" placeholder="Airport" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Est. distance (${unitLabel(distanceUnit)})`}><Input name="distance" inputMode="decimal" required placeholder="6.2" /></Field>
            <Field label="Est. duration (min)"><Input name="duration" inputMode="numeric" required placeholder="18" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Payout"><Input name="payout" inputMode="decimal" required placeholder="12.80" /></Field>
            <Field label="Tip (if shown)"><Input name="tip" inputMode="decimal" placeholder="0.00" /></Field>
          </div>
          {error && <p className="text-sm text-negative" role="alert">{error}</p>}
          <Button className="w-full" disabled={loading}>{loading ? "Evaluating…" : "Evaluate offer"}</Button>
        </form>
      </Modal>
    </div>
  );
}
