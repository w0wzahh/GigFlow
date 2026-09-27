"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader, Stat, Badge, Button, Progress, EmptyState, Skeleton } from "@/components/ui/primitives";
import { PlatformDot } from "@/components/platform-dot";
import { AreaTrend } from "@/components/charts";
import { LogWorkModal, ExpenseModal, MileageModal } from "@/components/quick-add";
import { formatMoney, formatDistance, formatDateTime } from "@/lib/units";
import { api } from "@/lib/client";
import { Plus, Receipt, Gauge, TrendingUp, Lightbulb, ArrowRight } from "lucide-react";

// Shape mirrors lib/dashboard.ts output (serialized — dates arrive as strings).
export type DashboardData = {
  currency: string;
  distanceUnit: "MI" | "KM";
  today: { grossCents: number };
  week: {
    grossCents: number; netCents: number; expensesCents: number; hours: number;
    distanceKm: number; distance: number; perHourCents: number | null; perDistanceCents: number | null;
    trips: number; deliveries: number;
  };
  month: { grossCents: number; netCents: number };
  byPlatform: { platformId: string | null; name: string; color: string; grossCents: number; jobs: number }[];
  series: { date: string; grossCents: number; expensesCents: number }[];
  goals: { id: string; name: string; period: string; targetCents: number; progressCents: number; progressPct: number }[];
  connections: { id: string; status: string; lastSyncAt: Date | string | null; platform: { name: string; color: string; key: string; status: string } }[];
  activity: { type: "TRIP" | "DELIVERY" | "EXPENSE"; at: Date | string; record: Record<string, unknown> }[];
  insights: string[];
};

type Option = { id: string; name?: string; nickname?: string };

export function DashboardView({ data }: { data: DashboardData }) {
  const [modal, setModal] = useState<"work" | "expense" | "mileage" | null>(null);
  const [platforms, setPlatforms] = useState<Option[]>([]);
  const [vehicles, setVehicles] = useState<Option[]>([]);
  const money = (c: number) => formatMoney(c, data.currency);
  const unit = data.distanceUnit;

  useEffect(() => {
    // Lazy-load select options only when a modal opens.
    if (!modal) return;
    void api<Option[]>("/api/platforms").then((ps) =>
      setPlatforms((ps as unknown as { id: string; name: string }[]).map((p) => ({ id: p.id, name: p.name }))),
    ).catch(() => {});
    void api<Option[]>("/api/vehicles").then(setVehicles).catch(() => {});
  }, [modal]);

  const empty = data.month.grossCents === 0 && data.activity.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] sm:text-[30px] font-bold tracking-tight leading-tight">Dashboard</h1>
          <p className="text-[15px] text-muted mt-1">Your gig work at a glance.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setModal("work")}><Plus size={14} /> Log work</Button>
          <Button size="sm" variant="outline" onClick={() => setModal("expense")}><Receipt size={14} /> Expense</Button>
          <Button size="sm" variant="outline" onClick={() => setModal("mileage")}><Gauge size={14} /> Mileage</Button>
        </div>
      </div>

      {empty && (
        <Card>
          <CardBody>
            <EmptyState
              icon={<TrendingUp size={28} />}
              title="Nothing tracked yet"
              body="Log your first trip or expense — or import an earnings statement from the Platforms page to populate your workspace."
              action={<Button size="sm" onClick={() => setModal("work")}><Plus size={14} /> Log your first trip</Button>}
            />
          </CardBody>
        </Card>
      )}

      {/* Top-line stats — staggered entrance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Today", value: money(data.today.grossCents), sub: "gross" },
          { label: "This week", value: money(data.week.grossCents), sub: `net ${money(data.week.netCents)}` },
          { label: "This month", value: money(data.month.grossCents), sub: `net ${money(data.month.netCents)}` },
          { label: "Est. profit this week", value: money(data.week.netCents), sub: `expenses ${money(data.week.expensesCents)}` },
        ].map((s, i) => (
          <Card key={s.label} className="animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
            <CardBody><Stat label={s.label} value={s.value} sub={s.sub} /></CardBody>
          </Card>
        ))}
      </div>

      {/* Efficiency metrics */}
      <Card className="animate-fade-up" style={{ animationDelay: "300ms" }}>
        <CardBody>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Stat label="Hours worked (week)" value={data.week.hours > 0 ? data.week.hours.toFixed(1) : "—"} />
            <Stat label={`Distance (week)`} value={data.week.distanceKm > 0 ? formatDistance(data.week.distanceKm, unit) : "—"} />
            <Stat label="Earnings / hour" value={data.week.perHourCents ? money(data.week.perHourCents) : "—"} />
            <Stat label={`Earnings / ${unit === "MI" ? "mile" : "km"}`} value={data.week.perDistanceCents ? money(data.week.perDistanceCents) : "—"} />
            <Stat label="Jobs (week)" value={String(data.week.trips + data.week.deliveries)} sub={`${data.week.trips} trips · ${data.week.deliveries} deliveries`} />
          </div>
        </CardBody>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Earnings trend */}
        <Card className="lg:col-span-2 animate-fade-up" style={{ animationDelay: "360ms" }}>
          <CardHeader title="Earnings trend" subtitle="Gross per day — last 30 days with data" />
          <CardBody>
            {data.series.length ? (
              <AreaTrend data={data.series} money={money} />
            ) : (
              <EmptyState title="No earnings yet" body="Your earnings trend will appear here once you log work." />
            )}
          </CardBody>
        </Card>

        {/* Goals */}
        <Card className="animate-fade-up" style={{ animationDelay: "420ms" }}>
          <CardHeader title="Goals" subtitle="Progress against your targets" />
          <CardBody className="space-y-4">
            {data.goals.length === 0 ? (
              <EmptyState title="No goals" body="Set a weekly earnings goal to track progress." action={<Link href="/settings/goals"><Button size="sm" variant="outline">Create goal</Button></Link>} />
            ) : (
              data.goals.map((g) => (
                <div key={g.id}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium">{g.name || `${g.period[0]}${g.period.slice(1).toLowerCase()} goal`}</span>
                    <span className="text-muted tabular-nums">{money(g.progressCents)} / {money(g.targetCents)}</span>
                  </div>
                  <Progress value={g.progressPct} />
                  <p className="text-[11px] text-faint mt-1">{g.progressPct.toFixed(1)}% of {g.period.toLowerCase()} target</p>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Platform breakdown */}
        <Card>
          <CardHeader title="By platform" subtitle="This month" action={<Link href="/platforms" className="text-xs text-accent">Manage</Link>} />
          <CardBody>
            {data.byPlatform.length === 0 ? (
              <EmptyState title="No platform earnings" body="Earnings by platform will appear here." />
            ) : (
              <ul className="divide-y divide-border">
                {data.byPlatform.slice(0, 6).map((p) => (
                  <li key={p.platformId ?? "none"} className="flex items-center gap-3 py-2.5">
                    <PlatformDot name={p.name} color={p.color} size={24} />
                    <span className="text-sm flex-1 truncate">{p.name}</span>
                    <span className="text-sm font-medium tabular-nums">{money(p.grossCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Insights */}
        <Card>
          <CardHeader title="Insights" subtitle="Computed from your data" />
          <CardBody>
            {data.insights.length === 0 ? (
              <EmptyState icon={<Lightbulb size={24} />} title="No insights yet" body="Insights appear once there's enough data to compare periods." />
            ) : (
              <ul className="space-y-3">
                {data.insights.map((i, idx) => (
                  <li key={idx} className="flex gap-2.5 text-sm text-muted">
                    <Lightbulb size={15} className="text-accent shrink-0 mt-0.5" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Connected platforms */}
        <Card>
          <CardHeader title="Platforms" subtitle="Connection status" action={<Link href="/platforms" className="text-xs text-accent inline-flex items-center gap-0.5">All <ArrowRight size={11} /></Link>} />
          <CardBody>
            {data.connections.length === 0 ? (
              <EmptyState title="No platforms" body="Add the platforms you drive for." action={<Link href="/platforms"><Button size="sm" variant="outline">Add platform</Button></Link>} />
            ) : (
              <ul className="divide-y divide-border">
                {data.connections.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <PlatformDot name={c.platform.name} color={c.platform.color} size={24} />
                    <span className="text-sm flex-1 truncate">{c.platform.name}</span>
                    <Badge tone={c.status === "CONNECTED" ? "positive" : c.status === "ERROR" ? "negative" : "neutral"}>
                      {c.status === "MANUAL" ? "Manual" : c.status.toLowerCase()}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="animate-fade-up" style={{ animationDelay: "500ms" }}>
        <CardHeader title="Recent activity" subtitle="Latest trips, deliveries and expenses" />
        <CardBody>
          {data.activity.length === 0 ? (
            <EmptyState title="No activity" body="Your latest work will show up here." />
          ) : (
            <ul className="divide-y divide-border">
              {data.activity.map((a, i) => {
                const r = a.record as Record<string, unknown>;
                const platform = r.platform as { name: string; color: string } | null | undefined;
                const isExpense = a.type === "EXPENSE";
                const amount = isExpense
                  ? -(r.amountCents as number)
                  : (r.payoutCents as number) + ((r.tipCents as number) ?? 0) + ((r.bonusCents as number) ?? 0);
                return (
                  <li key={i} className="flex items-center gap-3 py-2.5">
                    <span className={`w-1.5 h-8 rounded-full shrink-0 ${isExpense ? "bg-negative/60" : "bg-accent"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">
                        {isExpense
                          ? `${(r.category as string).replace(/_/g, " ").toLowerCase()} expense`
                          : `${a.type === "TRIP" ? "Trip" : "Delivery"}${platform ? ` · ${platform.name}` : ""}`}
                        {typeof r.source === "string" && (r.source === "IMPORT" || r.source === "SYNC") && (
                          <Badge tone="accent" className="ml-2">{r.source === "IMPORT" ? "import" : "sync"}</Badge>
                        )}
                      </p>
                      <p className="text-xs text-faint">{formatDateTime(a.at)}</p>
                    </div>
                    <span className={`text-sm font-medium tabular-nums ${isExpense ? "text-negative" : ""}`}>
                      {money(amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <LogWorkModal open={modal === "work"} onClose={() => setModal(null)} platforms={platforms as {id:string;name:string}[]} vehicles={vehicles as {id:string;nickname:string}[]} distanceUnit={unit} />
      <ExpenseModal open={modal === "expense"} onClose={() => setModal(null)} vehicles={vehicles as {id:string;nickname:string}[]} />
      <MileageModal open={modal === "mileage"} onClose={() => setModal(null)} vehicles={vehicles as {id:string;nickname:string}[]} distanceUnit={unit} />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-56" />
    </div>
  );
}
