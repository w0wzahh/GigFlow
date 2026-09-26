"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, Field, Input, Select, Badge } from "@/components/ui/primitives";
import { PlatformDot } from "@/components/platform-dot";
import { api, ApiClientError } from "@/lib/client";
import { cn } from "@/lib/cn";
import { Check } from "lucide-react";

type PlatformOption = {
  id: string; key: string; name: string; color: string;
  status: string; statusNote: string | null;
};

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "BRL", "MXN", "INR", "PHP", "NGN"];
const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Toronto", "America/Sao_Paulo", "Europe/London", "Europe/Berlin", "Europe/Madrid",
  "Africa/Lagos", "Asia/Dubai", "Asia/Kolkata", "Asia/Manila", "Australia/Sydney",
];

const STEPS = ["Profile", "Platforms", "Vehicle", "Goals"] as const;

export function OnboardingWizard({
  userName,
  platforms,
  defaultTimezone,
}: {
  userName: string;
  platforms: PlatformOption[];
  defaultTimezone: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: userName,
    currency: "USD",
    country: "US",
    timezone: TIMEZONES.includes(defaultTimezone) ? defaultTimezone : "UTC",
    distanceUnit: "MI" as "MI" | "KM",
    targetHourly: "",
    weeklyGoal: "",
    platformKeys: [] as string[],
    enableDemo: true,
    vehicle: {
      nickname: "", make: "", model: "", year: "",
      fuelType: "", fuelEconomy: "", financing: "",
    },
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setV = (k: keyof typeof form.vehicle, v: string) =>
    setForm((f) => ({ ...f, vehicle: { ...f.vehicle, [k]: v } }));

  const togglePlatform = (key: string) =>
    set("platformKeys",
      form.platformKeys.includes(key)
        ? form.platformKeys.filter((k) => k !== key)
        : [...form.platformKeys, key],
    );

  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      const vehicle = form.vehicle.nickname.trim()
        ? {
            nickname: form.vehicle.nickname.trim(),
            make: form.vehicle.make || null,
            model: form.vehicle.model || null,
            year: form.vehicle.year ? Number(form.vehicle.year) : null,
            fuelType: (form.vehicle.fuelType || null) as "GAS" | "DIESEL" | "HYBRID" | "EV" | "OTHER" | null,
            fuelEconomy: form.vehicle.fuelEconomy ? Number(form.vehicle.fuelEconomy) : null,
            financing: (form.vehicle.financing || null) as "OWNED" | "FINANCED" | "LEASED" | "RENTAL" | null,
          }
        : null;
      await api("/api/onboarding", {
        method: "POST",
        body: {
          name: form.name,
          currency: form.currency,
          country: form.country,
          timezone: form.timezone,
          distanceUnit: form.distanceUnit,
          targetHourlyCents: form.targetHourly ? Math.round(Number(form.targetHourly) * 100) : null,
          weeklyGoalCents: form.weeklyGoal ? Math.round(Number(form.weeklyGoal) * 100) : null,
          platformKeys: form.platformKeys,
          vehicle,
          enableDemo: form.enableDemo,
        },
      });
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Setup failed — please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-lg">
      {/* Stepper */}
      <ol className="flex items-center gap-2 mb-6" aria-label="Setup progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2 flex-1 last:flex-none">
            <span
              className={cn(
                "w-6 h-6 rounded-full text-[11px] font-semibold inline-flex items-center justify-center shrink-0",
                i < step ? "bg-accent text-accent-fg" : i === step ? "bg-accent-soft text-accent border border-accent" : "bg-subtle text-faint",
              )}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? <Check size={12} /> : i + 1}
            </span>
            <span className={cn("text-xs hidden sm:inline", i === step ? "font-medium" : "text-faint")}>{s}</span>
            {i < STEPS.length - 1 && <span className="flex-1 h-px bg-border" />}
          </li>
        ))}
      </ol>

      <Card>
        <CardBody className="pt-5">
          {step === 0 && (
            <div className="space-y-4">
              <h1 className="text-lg font-semibold">Welcome to GigFlow</h1>
              <p className="text-sm text-muted -mt-2">A few basics so numbers are shown the way you think about them.</p>
              <Field label="Your name"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Currency">
                  <Select value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </Select>
                </Field>
                <Field label="Country">
                  <Input value={form.country} maxLength={2} onChange={(e) => set("country", e.target.value.toUpperCase())} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Timezone">
                  <Select value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
                    {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Distance unit">
                  <Select value={form.distanceUnit} onChange={(e) => set("distanceUnit", e.target.value as "MI" | "KM")}>
                    <option value="MI">Miles</option>
                    <option value="KM">Kilometers</option>
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h1 className="text-lg font-semibold">Which platforms do you drive for?</h1>
              <p className="text-sm text-muted -mt-2">
                Select all that apply. Most platforms do not offer a public data API —
                those work with manual tracking. You can change this later.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {platforms.map((p) => {
                  const selected = form.platformKeys.includes(p.key);
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => togglePlatform(p.key)}
                      aria-pressed={selected}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                        selected ? "border-accent bg-accent-soft/50" : "border-border hover:border-border-strong",
                      )}
                    >
                      <PlatformDot name={p.name} color={p.color} size={26} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-[11px] text-faint">
                          {p.status === "MOCK" ? "Demo data" : p.status === "UNAVAILABLE" ? "Manual only" : p.status === "COMING_SOON" ? "Coming soon" : "Manual tracking"}
                        </p>
                      </div>
                      {selected && <Check size={14} className="text-accent shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h1 className="text-lg font-semibold">Your vehicle</h1>
              <p className="text-sm text-muted -mt-2">Optional — powers per-mile metrics and expense tracking. You can add more later.</p>
              <Field label="Nickname" hint='e.g. "Camry", "Work car"'>
                <Input value={form.vehicle.nickname} onChange={(e) => setV("nickname", e.target.value)} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Make"><Input value={form.vehicle.make} onChange={(e) => setV("make", e.target.value)} /></Field>
                <Field label="Model"><Input value={form.vehicle.model} onChange={(e) => setV("model", e.target.value)} /></Field>
                <Field label="Year"><Input inputMode="numeric" value={form.vehicle.year} onChange={(e) => setV("year", e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Fuel type">
                  <Select value={form.vehicle.fuelType} onChange={(e) => setV("fuelType", e.target.value)}>
                    <option value="">—</option>
                    <option value="GAS">Gas</option><option value="DIESEL">Diesel</option>
                    <option value="HYBRID">Hybrid</option><option value="EV">EV</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </Field>
                <Field label={`Economy (${form.distanceUnit === "MI" ? "MPG" : "L/100km"})`}>
                  <Input inputMode="decimal" value={form.vehicle.fuelEconomy} onChange={(e) => setV("fuelEconomy", e.target.value)} />
                </Field>
                <Field label="Ownership">
                  <Select value={form.vehicle.financing} onChange={(e) => setV("financing", e.target.value)}>
                    <option value="">—</option>
                    <option value="OWNED">Owned</option><option value="FINANCED">Financed</option>
                    <option value="LEASED">Leased</option><option value="RENTAL">Rental</option>
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h1 className="text-lg font-semibold">Goals & demo data</h1>
              <div className="grid grid-cols-2 gap-3">
                <Field label={`Target $/hour (${form.currency})`}>
                  <Input inputMode="decimal" placeholder="25" value={form.targetHourly} onChange={(e) => set("targetHourly", e.target.value)} />
                </Field>
                <Field label={`Weekly goal (${form.currency})`}>
                  <Input inputMode="decimal" placeholder="1000" value={form.weeklyGoal} onChange={(e) => set("weeklyGoal", e.target.value)} />
                </Field>
              </div>
              <button
                type="button"
                onClick={() => set("enableDemo", !form.enableDemo)}
                aria-pressed={form.enableDemo}
                className={cn(
                  "w-full flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                  form.enableDemo ? "border-accent bg-accent-soft/50" : "border-border",
                )}
              >
                <span className={cn("mt-0.5 w-4 h-4 rounded border inline-flex items-center justify-center", form.enableDemo ? "bg-accent border-accent text-accent-fg" : "border-border-strong")}>
                  {form.enableDemo && <Check size={12} />}
                </span>
                <span>
                  <span className="text-sm font-medium flex items-center gap-2">Explore with demo data <Badge tone="accent">Recommended</Badge></span>
                  <span className="block text-xs text-muted mt-1">
                    Populate your workspace with clearly-marked sample trips, earnings, expenses and offers so you can see how GigFlow works. Remove it any time in Settings → Data.
                  </span>
                </span>
              </button>
              {error && <p className="text-sm text-negative" role="alert">{error}</p>}
            </div>
          )}

          <div className="flex justify-between mt-6 pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>Back</Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>
            ) : (
              <Button onClick={finish} disabled={saving}>{saving ? "Setting up…" : "Finish setup"}</Button>
            )}
          </div>
          <div className="text-center mt-2">
            <button
              className="text-xs text-faint hover:text-muted"
              onClick={async () => {
                await api("/api/onboarding", {
                  method: "POST",
                  body: { ...form, platformKeys: [], vehicle: null, enableDemo: false, targetHourlyCents: null, weeklyGoalCents: null },
                });
                router.push("/dashboard");
                router.refresh();
              }}
            >
              Skip setup
            </button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
