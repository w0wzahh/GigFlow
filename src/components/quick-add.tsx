"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { api, ApiClientError } from "@/lib/client";

type PlatformOpt = { id: string; name: string };
type VehicleOpt = { id: string; nickname: string };

export const EXPENSE_CATEGORIES = [
  "FUEL", "CHARGING", "MAINTENANCE", "INSURANCE", "PARKING",
  "TOLLS", "CAR_PAYMENT", "LEASE", "PHONE", "OTHER",
] as const;

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function useFormSubmit(onDone?: () => void) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = (fn: () => Promise<unknown>) => async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      await fn();
      onDone?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };
  return { error, loading, submit };
}

const moneyToCents = (v: FormDataEntryValue | null) =>
  Math.round(Math.max(0, Number(v ?? 0)) * 100);

export function LogWorkModal({
  open, onClose, platforms, vehicles, distanceUnit,
}: {
  open: boolean; onClose: () => void;
  platforms: PlatformOpt[]; vehicles: VehicleOpt[]; distanceUnit: "MI" | "KM";
}) {
  const { error, loading, submit } = useFormSubmit(onClose);
  const [kind, setKind] = useState<"TRIP" | "DELIVERY">("TRIP");
  const toKm = (v: number) => (distanceUnit === "MI" ? v * 1.609344 : v);
  return (
    <Modal open={open} onClose={onClose} title="Log work" wide>
      <form
        onSubmit={submit(async () => {
          const fd = new FormData(document.getElementById("log-work-form") as HTMLFormElement);
          const startedAt = new Date(`${fd.get("date")}T${fd.get("time") || "12:00"}`);
          const durationMin = Number(fd.get("durationMin") || 0);
          await api("/api/activities", {
            method: "POST",
            body: {
              kind,
              platformId: fd.get("platformId") || null,
              vehicleId: fd.get("vehicleId") || null,
              startedAt: startedAt.toISOString(),
              endedAt: durationMin > 0 ? new Date(startedAt.getTime() + durationMin * 60000).toISOString() : null,
              durationMin,
              distanceKm: toKm(Number(fd.get("distance") || 0)),
              pickupZone: fd.get("pickup") || null,
              dropoffZone: fd.get("dropoff") || null,
              payoutCents: moneyToCents(fd.get("payout")),
              tipCents: moneyToCents(fd.get("tip")),
              bonusCents: moneyToCents(fd.get("bonus")),
            },
          });
        })}
        id="log-work-form"
        className="space-y-4"
      >
        <div className="flex gap-2" role="group" aria-label="Work type">
          {(["TRIP", "DELIVERY"] as const).map((k) => (
            <button
              key={k} type="button" onClick={() => setKind(k)}
              className={`flex-1 h-9 rounded-lg border text-sm font-medium ${kind === k ? "border-accent bg-accent-soft text-accent" : "border-border text-muted"}`}
            >
              {k === "TRIP" ? "Trip (rideshare)" : "Delivery"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input name="date" type="date" required defaultValue={todayLocal()} /></Field>
          <Field label="Start time"><Input name="time" type="time" defaultValue="18:00" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Platform">
            <Select name="platformId">
              <option value="">—</option>
              {platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Vehicle">
            <Select name="vehicleId">
              <option value="">—</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.nickname}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Distance (${distanceUnit === "MI" ? "mi" : "km"})`}><Input name="distance" inputMode="decimal" placeholder="8.4" /></Field>
          <Field label="Duration (min)"><Input name="durationMin" inputMode="numeric" placeholder="22" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pickup zone"><Input name="pickup" placeholder="Downtown" /></Field>
          <Field label="Dropoff zone"><Input name="dropoff" placeholder="Airport" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Payout"><Input name="payout" inputMode="decimal" required placeholder="14.50" /></Field>
          <Field label="Tip"><Input name="tip" inputMode="decimal" placeholder="0.00" /></Field>
          <Field label="Bonus"><Input name="bonus" inputMode="decimal" placeholder="0.00" /></Field>
        </div>
        {error && <p className="text-sm text-negative" role="alert">{error}</p>}
        <Button className="w-full" disabled={loading}>{loading ? "Saving…" : "Save"}</Button>
      </form>
    </Modal>
  );
}

export function ExpenseModal({
  open, onClose, vehicles, edit,
}: {
  open: boolean; onClose: () => void; vehicles: VehicleOpt[];
  edit?: { id: string; category: string; amountCents: number; occurredAt: string; description: string | null; vehicleId: string | null } | null;
}) {
  const { error, loading, submit } = useFormSubmit(onClose);
  return (
    <Modal open={open} onClose={onClose} title={edit ? "Edit expense" : "Add expense"}>
      <form
        key={edit?.id ?? "new"}
        onSubmit={submit(async () => {
          const fd = new FormData(document.getElementById("expense-form") as HTMLFormElement);
          const body = {
            category: fd.get("category"),
            amountCents: moneyToCents(fd.get("amount")),
            occurredAt: String(fd.get("date")),
            description: fd.get("description") || null,
            vehicleId: fd.get("vehicleId") || null,
          };
          if (edit) await api(`/api/expenses/${edit.id}`, { method: "PATCH", body });
          else await api("/api/expenses", { method: "POST", body });
        })}
        id="expense-form"
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select name="category" defaultValue={edit?.category ?? "FUEL"}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, " ").toLowerCase().replace(/^\w/, (x) => x.toUpperCase())}</option>
              ))}
            </Select>
          </Field>
          <Field label="Amount"><Input name="amount" inputMode="decimal" required defaultValue={edit ? (edit.amountCents / 100).toFixed(2) : ""} placeholder="42.00" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input name="date" type="date" required defaultValue={edit?.occurredAt?.slice(0, 10) ?? todayLocal()} /></Field>
          <Field label="Vehicle">
            <Select name="vehicleId" defaultValue={edit?.vehicleId ?? ""}>
              <option value="">—</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.nickname}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Description"><Input name="description" defaultValue={edit?.description ?? ""} placeholder="Fuel fill-up" /></Field>
        {error && <p className="text-sm text-negative" role="alert">{error}</p>}
        <Button className="w-full" disabled={loading}>{loading ? "Saving…" : "Save expense"}</Button>
      </form>
    </Modal>
  );
}

export function MileageModal({
  open, onClose, vehicles, distanceUnit,
}: {
  open: boolean; onClose: () => void; vehicles: VehicleOpt[]; distanceUnit: "MI" | "KM";
}) {
  const { error, loading, submit } = useFormSubmit(onClose);
  const toKm = (v: number) => (distanceUnit === "MI" ? v * 1.609344 : v);
  return (
    <Modal open={open} onClose={onClose} title="Log mileage">
      <form
        onSubmit={submit(async () => {
          const fd = new FormData(document.getElementById("mileage-form") as HTMLFormElement);
          await api("/api/mileage", {
            method: "POST",
            body: {
              date: String(fd.get("date")),
              distanceKm: toKm(Number(fd.get("distance") || 0)),
              purpose: fd.get("purpose"),
              vehicleId: fd.get("vehicleId") || null,
              startLocation: fd.get("start") || null,
              endLocation: fd.get("end") || null,
            },
          });
        })}
        id="mileage-form"
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input name="date" type="date" required defaultValue={todayLocal()} /></Field>
          <Field label={`Distance (${distanceUnit === "MI" ? "mi" : "km"})`}><Input name="distance" inputMode="decimal" required placeholder="34.2" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Purpose">
            <Select name="purpose" defaultValue="WORK">
              <option value="WORK">Work</option>
              <option value="PERSONAL">Personal</option>
              <option value="OTHER">Other</option>
            </Select>
          </Field>
          <Field label="Vehicle">
            <Select name="vehicleId">
              <option value="">—</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.nickname}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From (optional)"><Input name="start" placeholder="Home" /></Field>
          <Field label="To (optional)"><Input name="end" placeholder="Downtown" /></Field>
        </div>
        {error && <p className="text-sm text-negative" role="alert">{error}</p>}
        <Button className="w-full" disabled={loading}>{loading ? "Saving…" : "Save mileage"}</Button>
      </form>
    </Modal>
  );
}
