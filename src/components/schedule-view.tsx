"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, Button, EmptyState, Field, Input, Select } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/page-header";
import { formatMoney } from "@/lib/units";
import { api, ApiClientError } from "@/lib/client";
import { Plus, Trash2, CalendarDays } from "lucide-react";

type Entry = {
  id: string; title: string | null; dayOfWeek: number | null; date: string | null;
  startMin: number; endMin: number; zone: string | null;
  targetCents: number | null; platformIds: string[];
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_INDEX = [1, 2, 3, 4, 5, 6, 0]; // column -> JS dayOfWeek

const fmtMin = (m: number) => {
  const h = Math.floor(m / 60); const mm = m % 60;
  const ampm = h >= 12 ? "p" : "a";
  return `${((h + 11) % 12) + 1}${mm ? `:${String(mm).padStart(2, "0")}` : ""}${ampm}`;
};
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

export function ScheduleView({
  entries, platforms, currency,
}: {
  entries: Entry[];
  platforms: { id: string; name: string; color: string }[];
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const money = (c: number) => formatMoney(c, currency);

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api("/api/schedule", {
        method: "POST",
        body: {
          title: fd.get("title") || null,
          dayOfWeek: Number(fd.get("dayOfWeek")),
          startMin: toMin(String(fd.get("start"))),
          endMin: toMin(String(fd.get("end"))),
          zone: fd.get("zone") || null,
          platformIds: selectedPlatforms.length ? selectedPlatforms : null,
          targetCents: fd.get("target") ? Math.round(Number(fd.get("target")) * 100) : null,
        },
      });
      setOpen(false);
      setSelectedPlatforms([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save.");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this block?")) return;
    await api(`/api/schedule/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const byDay = new Map<number, Entry[]>();
  for (const e of entries) {
    if (e.dayOfWeek == null) continue;
    const list = byDay.get(e.dayOfWeek) ?? [];
    list.push(e);
    byDay.set(e.dayOfWeek, list);
  }
  const oneOffs = entries.filter((e) => e.dayOfWeek == null);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Schedule"
        subtitle="Plan your working blocks. Recommendations based on your best hours will appear here as you collect data."
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus size={14} /> Add block</Button>}
      />

      <Card>
        <CardBody className="p-0 sm:p-0">
          <div className="grid grid-cols-7 divide-x divide-border min-h-64">
            {DAYS.map((label, i) => {
              const dow = DAY_INDEX[i];
              const dayEntries = byDay.get(dow) ?? [];
              return (
                <div key={label} className="flex flex-col">
                  <p className="text-[11px] font-medium text-muted text-center py-2.5 border-b border-border">{label}</p>
                  <div className="flex-1 p-1.5 space-y-1.5">
                    {dayEntries.map((e) => (
                      <div key={e.id} className="group rounded-md bg-accent-soft/70 border border-accent/20 p-1.5 relative">
                        <p className="text-[10px] font-medium text-accent leading-tight">{fmtMin(e.startMin)}–{fmtMin(e.endMin)}</p>
                        {e.zone && <p className="text-[10px] text-muted truncate">{e.zone}</p>}
                        {e.targetCents != null && <p className="text-[10px] text-faint">{money(e.targetCents)}</p>}
                        <button
                          onClick={() => remove(e.id)} aria-label="Delete block"
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-negative text-white hidden group-hover:flex items-center justify-center"
                        ><Trash2 size={9} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {entries.length === 0 && (
        <Card><CardBody>
          <EmptyState icon={<CalendarDays size={26} />} title="No working blocks" body="Add recurring blocks like 'Weekday evenings, Downtown' to plan your week." action={<Button size="sm" onClick={() => setOpen(true)}><Plus size={14} /> Add block</Button>} />
        </CardBody></Card>
      )}

      {oneOffs.length > 0 && (
        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold mb-3">One-off blocks</h3>
            <ul className="divide-y divide-border">
              {oneOffs.map((e) => (
                <li key={e.id} className="py-2.5 flex items-center justify-between text-sm">
                  <span>{e.title || "Work block"} — {e.date} {fmtMin(e.startMin)}–{fmtMin(e.endMin)}</span>
                  <button onClick={() => remove(e.id)} aria-label="Delete" className="text-faint hover:text-negative p-1"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add work block">
        <form onSubmit={add} className="space-y-4">
          <Field label="Title (optional)"><Input name="title" placeholder="Dinner rush" /></Field>
          <Field label="Repeats on">
            <Select name="dayOfWeek" defaultValue="5">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <option key={d} value={d}>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d]}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From"><Input name="start" type="time" required defaultValue="17:00" /></Field>
            <Field label="To"><Input name="end" type="time" required defaultValue="21:00" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Zone (optional)"><Input name="zone" placeholder="Downtown" /></Field>
            <Field label={`Target (${currency})`}><Input name="target" inputMode="decimal" placeholder="120" /></Field>
          </div>
          {platforms.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted mb-1.5">Platforms</p>
              <div className="flex flex-wrap gap-1.5">
                {platforms.map((p) => {
                  const on = selectedPlatforms.includes(p.id);
                  return (
                    <button
                      key={p.id} type="button" aria-pressed={on}
                      onClick={() => setSelectedPlatforms(on ? selectedPlatforms.filter((x) => x !== p.id) : [...selectedPlatforms, p.id])}
                      className={`px-2.5 h-7 rounded-md text-xs border ${on ? "border-accent bg-accent-soft text-accent" : "border-border text-muted"}`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {error && <p className="text-sm text-negative" role="alert">{error}</p>}
          <Button className="w-full" disabled={loading}>{loading ? "Saving…" : "Add block"}</Button>
        </form>
      </Modal>
    </div>
  );
}
