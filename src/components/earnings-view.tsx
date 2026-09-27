"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardBody, CardHeader, Stat, Button, Badge, EmptyState, Field, Input, Select } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/page-header";
import { PlatformDot } from "@/components/platform-dot";
import { MiniBars } from "@/components/charts";
import { formatMoney, formatDateTime } from "@/lib/units";
import { api, ApiClientError } from "@/lib/client";
import type { MetricsSummary, PlatformBreakdownRow, DailyPoint } from "@/lib/metrics";
import { Plus, Trash2 } from "lucide-react";

type EarningRow = {
  id: string; category: string; amountCents: number; tipCents: number;
  bonusCents: number; adjustmentsCents: number; earnedAt: string;
  hours: number; distanceKm: number; notes: string | null; source: string;
  platform: { id: string; name: string; color: string } | null;
};

const RANGES = [
  ["today", "Today"], ["week", "This week"], ["month", "This month"],
  ["year", "This year"], ["all", "All time"],
] as const;

export function RangeTabs({ rangeKey, base }: { rangeKey: string; base: string }) {
  return (
    <div className="segmented" role="tablist" aria-label="Date range">
      {RANGES.map(([k, label]) => (
        <Link
          key={k} href={`${base}?range=${k}`} role="tab" aria-selected={rangeKey === k}
          className={`px-3.5 h-8 inline-flex items-center text-[13px] font-medium transition-colors ${
            rangeKey === k
              ? "bg-elevated text-fg shadow-[var(--shadow-card)]"
              : "text-muted hover:text-fg"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

export function EarningsView({
  currency, distanceUnit, rangeKey, summary, byPlatform, series, earnings, platforms,
}: {
  currency: string; distanceUnit: "MI" | "KM"; rangeKey: string;
  summary: MetricsSummary; byPlatform: PlatformBreakdownRow[]; series: DailyPoint[];
  earnings: EarningRow[];
  platforms: { id: string; name: string }[];
}) {
  const router = useRouter();
  const money = (c: number) => formatMoney(c, currency);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toKm = (v: number) => (distanceUnit === "MI" ? v * 1.609344 : v);

  const addEarning = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api("/api/earnings", {
        method: "POST",
        body: {
          platformId: fd.get("platformId") || null,
          category: fd.get("category"),
          amountCents: Math.round(Number(fd.get("amount")) * 100),
          tipCents: Math.round(Number(fd.get("tip") || 0) * 100),
          bonusCents: Math.round(Number(fd.get("bonus") || 0) * 100),
          earnedAt: String(fd.get("date")),
          hours: Number(fd.get("hours") || 0),
          distanceKm: toKm(Number(fd.get("distance") || 0)),
          notes: fd.get("notes") || null,
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

  const remove = async (id: string) => {
    if (!confirm("Delete this earning?")) return;
    await api(`/api/earnings/${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Earnings"
        subtitle="All income across platforms."
        actions={
          <>
            <RangeTabs rangeKey={rangeKey} base="/earnings" />
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} /> Add earning</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card><CardBody><Stat label="Gross" value={money(summary.grossCents)} /></CardBody></Card>
        <Card><CardBody><Stat label="Net (after expenses)" value={money(summary.netCents)} /></CardBody></Card>
        <Card><CardBody><Stat label="Tips" value={money(summary.tipsCents)} /></CardBody></Card>
        <Card><CardBody><Stat label="Bonuses" value={money(summary.bonusesCents)} /></CardBody></Card>
        <Card><CardBody><Stat label="/ hour" value={summary.perHourCents ? money(summary.perHourCents) : "—"} /></CardBody></Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Earnings over time" subtitle="Daily gross" />
          <CardBody>
            {series.length ? <MiniBars data={series} money={money} height={200} /> : <EmptyState title="No data in range" />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="By platform" />
          <CardBody>
            {byPlatform.length === 0 ? <EmptyState title="Nothing yet" /> : (
              <ul className="divide-y divide-border">
                {byPlatform.map((p) => (
                  <li key={p.platformId ?? "x"} className="flex items-center gap-3 py-2.5">
                    <PlatformDot name={p.name} color={p.color} size={22} />
                    <span className="text-sm flex-1 truncate">{p.name}</span>
                    <span className="text-sm font-medium tabular-nums">{money(p.grossCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Entries" subtitle={`${earnings.length} shown`} />
        <CardBody>
          {earnings.length === 0 ? (
            <EmptyState title="No earnings in this range" body="Add an earning or log work to see entries here." action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} /> Add earning</Button>} />
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-5">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-xs text-faint border-b border-border">
                    <th className="px-4 sm:px-5 py-2 font-medium">When</th>
                    <th className="py-2 font-medium">Platform</th>
                    <th className="py-2 font-medium">Category</th>
                    <th className="py-2 font-medium text-right">Tips</th>
                    <th className="py-2 font-medium text-right">Gross</th>
                    <th className="py-2 font-medium w-8"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {earnings.map((e) => (
                    <tr key={e.id} className="group">
                      <td className="px-4 sm:px-5 py-2.5 whitespace-nowrap text-muted">{formatDateTime(e.earnedAt)}
                        {e.source === "IMPORT" && <Badge tone="accent" className="ml-1.5">import</Badge>}
                        {e.source === "SYNC" && <Badge tone="accent" className="ml-1.5">sync</Badge>}
                      </td>
                      <td className="py-2.5">
                        {e.platform ? (
                          <span className="inline-flex items-center gap-1.5"><PlatformDot name={e.platform.name} color={e.platform.color} size={18} />{e.platform.name}</span>
                        ) : "—"}
                      </td>
                      <td className="py-2.5 text-muted">{e.category.toLowerCase()}</td>
                      <td className="py-2.5 text-right tabular-nums text-muted">{e.tipCents ? money(e.tipCents) : "—"}</td>
                      <td className="py-2.5 text-right tabular-nums font-medium">{money(e.amountCents + e.tipCents + e.bonusCents + e.adjustmentsCents)}</td>
                      <td className="py-2.5 text-right">
                        <button onClick={() => remove(e.id)} aria-label="Delete earning" className="text-faint hover:text-negative opacity-0 group-hover:opacity-100 focus:opacity-100 p-1"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add earning">
        <form onSubmit={addEarning} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><Input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
            <Field label="Category">
              <Select name="category" defaultValue="TRIP">
                {["TRIP", "DELIVERY", "TIP", "BONUS", "ADJUSTMENT", "QUEST", "OTHER"].map((c) => <option key={c} value={c}>{c.toLowerCase()}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Platform">
            <Select name="platformId"><option value="">—</option>{platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Base amount"><Input name="amount" inputMode="decimal" required placeholder="18.50" /></Field>
            <Field label="Tip"><Input name="tip" inputMode="decimal" placeholder="0" /></Field>
            <Field label="Bonus"><Input name="bonus" inputMode="decimal" placeholder="0" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hours"><Input name="hours" inputMode="decimal" placeholder="0.5" /></Field>
            <Field label={`Distance (${distanceUnit === "MI" ? "mi" : "km"})`}><Input name="distance" inputMode="decimal" placeholder="0" /></Field>
          </div>
          <Field label="Notes"><Input name="notes" placeholder="Optional" /></Field>
          {error && <p className="text-sm text-negative" role="alert">{error}</p>}
          <Button className="w-full" disabled={loading}>{loading ? "Saving…" : "Save earning"}</Button>
        </form>
      </Modal>
    </div>
  );
}
