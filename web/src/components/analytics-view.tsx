"use client";

import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, Stat, EmptyState, Select } from "@/components/ui/primitives";
import { PageHeader } from "@/components/page-header";
import { RangeTabs } from "@/components/earnings-view";
import { PlatformDot } from "@/components/platform-dot";
import { EarningsChart, PlatformDonut } from "@/components/charts";
import { formatMoney, kmToUnit, unitLabel } from "@/lib/units";
import type { AnalyticsData } from "@/lib/analytics";
import { BarChart3, Lightbulb } from "lucide-react";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Delta({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null || previous == null || previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const up = pct >= 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-positive" : "text-negative"}`}>
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

export function AnalyticsView({
  data, rangeKey, platformId, vehicleId,
}: {
  data: AnalyticsData; rangeKey: string; platformId: string; vehicleId: string;
}) {
  const router = useRouter();
  const money = (c: number) => formatMoney(c, data.currency);
  const unit = data.distanceUnit;
  const c = data.current;
  const p = data.previous;

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams({ range: rangeKey });
    if (key === "platformId" ? value || platformId : platformId) params.set("platformId", key === "platformId" ? value : platformId);
    if (key === "vehicleId" ? value || vehicleId : vehicleId) params.set("vehicleId", key === "vehicleId" ? value : vehicleId);
    router.push(`/analytics?${params.toString()}`);
  };

  const bestDay = [...data.byDayOfWeek].sort((a, b) => (b.jobs ? b.grossCents / b.jobs : 0) - (a.jobs ? a.grossCents / a.jobs : 0))[0];
  const maxDow = Math.max(1, ...data.byDayOfWeek.map((d) => d.grossCents));
  const maxHour = Math.max(1, ...data.byHour.map((h) => h.jobs));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        subtitle="How your work is actually performing."
        actions={
          <>
            <Select value={platformId} onChange={(e) => setFilter("platformId", e.target.value)} className="w-40" aria-label="Filter by platform">
              <option value="">All platforms</option>
              {data.filters.platforms.map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
            </Select>
            <Select value={vehicleId} onChange={(e) => setFilter("vehicleId", e.target.value)} className="w-40" aria-label="Filter by vehicle">
              <option value="">All vehicles</option>
              {data.filters.vehicles.map((v) => <option key={v.id} value={v.id}>{v.nickname}</option>)}
            </Select>
            <RangeTabs rangeKey={rangeKey} base="/analytics" />
          </>
        }
      />

      {/* Headline metrics with period comparison */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Gross", cur: c.grossCents, prev: p?.grossCents, fmt: money },
          { label: "Net", cur: c.netCents, prev: p?.netCents, fmt: money },
          { label: "Per hour", cur: c.perHourCents, prev: p?.perHourCents ?? null, fmt: money },
          { label: `Per ${unitLabel(unit)}`, cur: c.perDistanceCents, prev: p && p.distanceKm > 0 ? Math.round(p.grossCents / kmToUnit(p.distanceKm, unit)) : null, fmt: money },
        ].map((m) => (
          <Card key={m.label}>
            <CardBody>
              <div className="flex items-baseline justify-between">
                <p className="text-xs text-muted">{m.label}</p>
                <Delta current={m.cur} previous={m.prev ?? null} />
              </div>
              <p className="text-xl font-semibold tracking-tight mt-0.5 tabular-nums">{m.cur != null ? m.fmt(m.cur) : "—"}</p>
              {p && <p className="text-[11px] text-faint mt-0.5">prev: {m.prev != null ? m.fmt(m.prev) : "—"}</p>}
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardBody><Stat label="Hours" value={c.hours > 0 ? c.hours.toFixed(1) : "—"} sub={p ? `prev ${p.hours.toFixed(1)}` : undefined} /></CardBody></Card>
        <Card><CardBody><Stat label="Distance" value={c.distanceKm > 0 ? `${c.distance.toFixed(1)} ${unitLabel(unit)}` : "—"} /></CardBody></Card>
        <Card><CardBody><Stat label="Jobs" value={String(c.trips + c.deliveries)} sub={c.avgTripCents ? `avg ${money(c.avgTripCents)}` : undefined} /></CardBody></Card>
        <Card><CardBody><Stat label="Expenses" value={money(c.expensesCents)} sub={p ? `prev ${money(p.expensesCents)}` : undefined} /></CardBody></Card>
      </div>

      {/* Trend + platform split */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Gross vs expenses" subtitle="Daily, in selected range" />
          <CardBody>
            {data.series.length ? <EarningsChart data={data.series} money={money} height={240} /> : <EmptyState title="No data in range" />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Platform share" subtitle="Gross earnings" />
          <CardBody>
            {data.byPlatform.length ? (
              <>
                <PlatformDonut data={data.byPlatform} money={money} height={170} />
                <ul className="mt-2 space-y-1.5">
                  {data.byPlatform.slice(0, 5).map((pl) => (
                    <li key={pl.platformId ?? "x"} className="flex items-center gap-2 text-xs">
                      <PlatformDot name={pl.name} color={pl.color} size={16} />
                      <span className="flex-1 truncate text-muted">{pl.name}</span>
                      <span className="tabular-nums font-medium">{money(pl.grossCents)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : <EmptyState title="No platform data" />}
          </CardBody>
        </Card>
      </div>

      {/* When you earn */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Best days" subtitle="Gross by day of week" />
          <CardBody>
            {data.byDayOfWeek.every((d) => d.jobs === 0) ? <EmptyState title="No work in range" /> : (
              <div className="flex items-end gap-2 h-36">
                {data.byDayOfWeek.map((d) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-faint tabular-nums">{d.grossCents ? money(d.grossCents) : ""}</span>
                    <div className="w-full rounded-t bg-accent/80" style={{ height: `${(d.grossCents / maxDow) * 100}%`, minHeight: d.grossCents ? 4 : 0 }} />
                    <span className="text-[10px] text-muted">{DOW[d.day]}</span>
                  </div>
                ))}
              </div>
            )}
            {bestDay && bestDay.jobs > 0 && (
              <p className="text-xs text-muted mt-3">Your most productive day: <span className="font-medium text-fg">{DOW[bestDay.day]}</span> ({money(Math.round(bestDay.grossCents / bestDay.jobs))}/job avg)</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Busiest hours" subtitle="Jobs started by hour of day" />
          <CardBody>
            {data.byHour.every((h) => h.jobs === 0) ? <EmptyState title="No work in range" /> : (
              <div className="flex items-end gap-0.5 h-36">
                {data.byHour.map((h) => (
                  <div key={h.hour} className="flex-1 flex flex-col items-center gap-1" title={`${h.hour}:00 — ${h.jobs} jobs`}>
                    <div className="w-full rounded-t bg-accent/70" style={{ height: `${(h.jobs / maxHour) * 100}%`, minHeight: h.jobs ? 3 : 0 }} />
                    {h.hour % 4 === 0 && <span className="text-[9px] text-faint">{h.hour}</span>}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Expense mix + insights */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Expense mix" />
          <CardBody>
            {data.expenseCategories.length === 0 ? <EmptyState title="No expenses" /> : (
              <ul className="space-y-2">
                {data.expenseCategories.map((x) => (
                  <li key={x.category} className="flex justify-between text-sm">
                    <span className="text-muted">{x.category.replace(/_/g, " ").toLowerCase()}</span>
                    <span className="tabular-nums font-medium">{money(x.amountCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Insights" subtitle="vs. previous period" />
          <CardBody>
            {data.insights.length === 0 ? <EmptyState icon={<Lightbulb size={24} />} title="Not enough data" body="Insights need at least two comparable periods." /> : (
              <ul className="space-y-3">
                {data.insights.map((i, k) => (
                  <li key={k} className="flex gap-2.5 text-sm text-muted"><Lightbulb size={15} className="text-accent shrink-0 mt-0.5" />{i}</li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-[11px] text-faint flex items-center gap-1">
              <BarChart3 size={11} /> All metrics are computed from your recorded data.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
