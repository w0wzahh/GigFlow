"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, Button, Badge, EmptyState, Field, Input, Select } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/page-header";
import { formatMoney } from "@/lib/units";
import { api, ApiClientError } from "@/lib/client";
import type { Rule, RuleCondition, EvaluationResult } from "@/lib/rules/engine";
import { Plus, Trash2, SlidersHorizontal, FlaskConical } from "lucide-react";

const FIELD_LABELS: Record<string, string> = {
  payout_cents: "Total payout",
  earnings_per_hour_cents: "Earnings per hour",
  earnings_per_km_cents: "Earnings per distance",
  est_distance_km: "Distance",
  est_duration_min: "Duration",
  profit_cents: "Est. profit",
  platform_name: "Platform",
};

const OP_LABELS: Record<string, string> = {
  gte: "≥", lte: "≤", gt: ">", lt: "<", eq: "=", neq: "≠", contains: "contains",
};

const MONEY_FIELDS = new Set(["payout_cents", "earnings_per_hour_cents", "earnings_per_km_cents", "profit_cents"]);

type DraftCondition = { field: string; op: string; value: string };

export function RulesView({
  rules, currency, distanceUnit, platforms,
}: {
  rules: (Rule & { id: string })[];
  currency: string; distanceUnit: "MI" | "KM";
  platforms: { id: string; name: string }[];
}) {
  const router = useRouter();
  const money = (c: number) => formatMoney(c, currency);
  const distFactor = distanceUnit === "MI" ? 1.609344 : 1;

  const [builderOpen, setBuilderOpen] = useState(false);
  const [testerOpen, setTesterOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [label, setLabel] = useState("Good Offer");
  const [conditions, setConditions] = useState<DraftCondition[]>([
    { field: "earnings_per_hour_cents", op: "gte", value: "25" },
  ]);
  const [testResult, setTestResult] = useState<{ metrics: { earningsPerHourCents: number | null; earningsPerKmCents: number | null; profitCents: number }; evaluation: EvaluationResult } | null>(null);

  // Convert a UI value into the stored base unit (cents or km).
  const toBase = (field: string, raw: string): number | string => {
    const n = Number(raw);
    if (isNaN(n)) return raw;
    if (field === "est_distance_km") return n * distFactor;
    if (MONEY_FIELDS.has(field)) {
      // earnings_per_km is displayed per mile/km but stored per km
      if (field === "earnings_per_km_cents") return Math.round((n * 100) / distFactor);
      return Math.round(n * 100);
    }
    return n;
  };
  const fromBase = (field: string, v: number | string): string => {
    const n = Number(v);
    if (isNaN(n)) return String(v);
    if (field === "est_distance_km") return (n / distFactor).toFixed(1);
    if (field === "earnings_per_km_cents") return ((n * distFactor) / 100).toFixed(2);
    if (MONEY_FIELDS.has(field)) return (n / 100).toFixed(2);
    return String(v);
  };

  const saveRule = async () => {
    setError(null);
    try {
      await api("/api/rules", {
        method: "POST",
        body: {
          name: name || "Untitled rule",
          enabled: true,
          priority: rules.length,
          conditions: conditions.map((c) => ({ field: c.field, op: c.op, value: toBase(c.field, c.value) })) as RuleCondition[],
          action: { label: label || "Labeled", notify: false },
        } satisfies { name: string; enabled: boolean; priority: number; conditions: RuleCondition[]; action: { label: string; notify: boolean } },
      });
      setBuilderOpen(false);
      setName(""); setConditions([{ field: "earnings_per_hour_cents", op: "gte", value: "25" }]);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not save rule.");
    }
  };

  const toggle = async (r: Rule & { id: string }) => {
    await api(`/api/rules/${r.id}`, { method: "PATCH", body: { enabled: !r.enabled } });
    router.refresh();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    await api(`/api/rules/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const runTest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await api<{ metrics: { earningsPerHourCents: number | null; earningsPerKmCents: number | null; profitCents: number }; evaluation: EvaluationResult }>(
      "/api/rules",
      {
        method: "PUT",
        body: {
          offer: {
            platformId: fd.get("platformId") || null,
            estDistanceKm: Number(fd.get("distance") || 0) * distFactor,
            estDurationMin: Number(fd.get("duration") || 0),
            payoutCents: Math.round(Number(fd.get("payout") || 0) * 100),
            tipCents: Math.round(Number(fd.get("tip") || 0) * 100),
          },
        },
      },
    );
    setTestResult(res);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Smart Rules"
        subtitle="Define what a good offer looks like. Offers are labeled automatically — GigFlow never accepts or declines for you."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setTesterOpen(true)}><FlaskConical size={14} /> Test rules</Button>
            <Button size="sm" onClick={() => setBuilderOpen(true)}><Plus size={14} /> New rule</Button>
          </>
        }
      />

      {rules.length === 0 ? (
        <Card><CardBody>
          <EmptyState
            icon={<SlidersHorizontal size={26} />}
            title="No rules yet"
            body='Create your first rule, e.g. "earnings ≥ $2/mi AND ≥ $25/h → mark as Good Offer".'
            action={<Button size="sm" onClick={() => setBuilderOpen(true)}><Plus size={14} /> New rule</Button>}
          />
        </CardBody></Card>
      ) : (
        <div className="space-y-3">
          {rules.map((r) => (
            <Card key={r.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{r.name}</p>
                      <Badge tone="accent">→ {r.action.label}</Badge>
                      {!r.enabled && <Badge>disabled</Badge>}
                    </div>
                    <div className="mt-2 text-xs text-muted font-mono space-y-0.5">
                      {r.conditions.map((c, i) => (
                        <p key={i}>
                          {i > 0 && <span className="text-faint">AND </span>}
                          {FIELD_LABELS[c.field]} {OP_LABELS[c.op]} {MONEY_FIELDS.has(c.field) ? money(Number(c.value) * (c.field === "earnings_per_km_cents" ? distFactor : 1)) : c.field === "est_distance_km" ? `${fromBase(c.field, c.value)} ${distanceUnit === "MI" ? "mi" : "km"}` : c.field === "est_duration_min" ? `${c.value} min` : c.value}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggle(r)}
                      role="switch" aria-checked={r.enabled} aria-label={`Toggle ${r.name}`}
                      className={`w-9 h-5 rounded-full transition-colors relative ${r.enabled ? "bg-accent" : "bg-border-strong"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${r.enabled ? "left-4.5 left-[18px]" : "left-0.5"}`} />
                    </button>
                    <button onClick={() => remove(r.id)} aria-label="Delete rule" className="text-faint hover:text-negative p-1.5"><Trash2 size={15} /></button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Rule builder */}
      <Modal open={builderOpen} onClose={() => setBuilderOpen(false)} title="New rule" wide>
        <div className="space-y-4">
          <Field label="Rule name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Good offer" /></Field>
          <div>
            <p className="text-xs font-medium text-muted mb-2">IF all of these are true…</p>
            <div className="space-y-2">
              {conditions.map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  {i > 0 && <span className="text-[10px] text-faint w-8">AND</span>}
                  <Select
                    className="flex-1" value={c.field} aria-label="Field"
                    onChange={(e) => setConditions(conditions.map((x, j) => j === i ? { ...x, field: e.target.value } : x))}
                  >
                    {Object.entries(FIELD_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </Select>
                  <Select
                    className="w-20" value={c.op} aria-label="Operator"
                    onChange={(e) => setConditions(conditions.map((x, j) => j === i ? { ...x, op: e.target.value } : x))}
                  >
                    {Object.entries(OP_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </Select>
                  <Input
                    className="w-28" value={c.value} aria-label="Value"
                    onChange={(e) => setConditions(conditions.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                  />
                  {conditions.length > 1 && (
                    <button aria-label="Remove condition" onClick={() => setConditions(conditions.filter((_, j) => j !== i))} className="text-faint hover:text-negative p-1"><Trash2 size={13} /></button>
                  )}
                </div>
              ))}
            </div>
            <Button
              size="sm" variant="ghost" className="mt-2"
              onClick={() => setConditions([...conditions, { field: "payout_cents", op: "gte", value: "5" }])}
            >
              <Plus size={13} /> Add condition
            </Button>
          </div>
          <Field label="…then label the offer as">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Good Offer" />
          </Field>
          {error && <p className="text-sm text-negative" role="alert">{error}</p>}
          <Button className="w-full" onClick={saveRule}>Save rule</Button>
        </div>
      </Modal>

      {/* Rule tester */}
      <Modal open={testerOpen} onClose={() => { setTesterOpen(false); setTestResult(null); }} title="Test rules against an offer" wide>
        <form onSubmit={runTest} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Platform">
              <Select name="platformId"><option value="">—</option>{platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
            </Field>
            <Field label="Payout"><Input name="payout" inputMode="decimal" required placeholder="14.00" /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label={`Distance (${distanceUnit === "MI" ? "mi" : "km"})`}><Input name="distance" inputMode="decimal" required placeholder="7" /></Field>
            <Field label="Duration (min)"><Input name="duration" inputMode="numeric" required placeholder="20" /></Field>
            <Field label="Tip"><Input name="tip" inputMode="decimal" placeholder="0" /></Field>
          </div>
          <Button className="w-full" variant="secondary">Evaluate</Button>
        </form>
        {testResult && (
          <div className="mt-4 rounded-lg border border-border p-4 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-[10px] text-faint">$/hr</p><p className="text-sm font-semibold">{testResult.metrics.earningsPerHourCents != null ? money(testResult.metrics.earningsPerHourCents) : "—"}</p></div>
              <div><p className="text-[10px] text-faint">$/{distanceUnit === "MI" ? "mi" : "km"}</p><p className="text-sm font-semibold">{testResult.metrics.earningsPerKmCents != null ? money(Math.round(testResult.metrics.earningsPerKmCents * distFactor)) : "—"}</p></div>
              <div><p className="text-[10px] text-faint">Profit</p><p className="text-sm font-semibold">{money(testResult.metrics.profitCents)}</p></div>
            </div>
            <p className="text-sm">
              {testResult.evaluation.matched
                ? <>Matches: {testResult.evaluation.labels.map((l) => <Badge key={l} tone="accent" className="ml-1">{l}</Badge>)}</>
                : <span className="text-muted">No rules matched this offer.</span>}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
