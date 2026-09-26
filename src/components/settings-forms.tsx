"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, Field, Input, Select, Badge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { api, ApiClientError } from "@/lib/client";
import { formatDateTime, formatMoney } from "@/lib/units";
import { Plus, Trash2, Monitor } from "lucide-react";

function useSave() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async (fn: () => Promise<unknown>, okText = "Saved.") => {
    setLoading(true); setMsg(null);
    try {
      await fn();
      setMsg({ kind: "ok", text: okText });
      router.refresh();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof ApiClientError ? e.message : "Something went wrong." });
    } finally {
      setLoading(false);
    }
  };
  return { msg, loading, run, router };
}

const Msg = ({ msg }: { msg: { kind: "ok" | "err"; text: string } | null }) =>
  msg ? <p className={`text-sm ${msg.kind === "ok" ? "text-positive" : "text-negative"}`} role="status">{msg.text}</p> : null;

/* ---------------- Profile ---------------- */

export function ProfileForm({ name, email, verified }: { name: string; email: string; verified: boolean }) {
  const { msg, loading, run } = useSave();
  return (
    <Card>
      <CardHeader title="Profile" subtitle="Your name and sign-in email." />
      <CardBody>
        <form
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => api("/api/account", { method: "PATCH", body: { name: fd.get("name"), email: fd.get("email") } }));
          }}
          className="space-y-4"
        >
          <Field label="Name"><Input name="name" defaultValue={name} /></Field>
          <Field label="Email" hint={verified ? undefined : "Not verified — a new link will be sent when you change it."}>
            <div className="flex gap-2 items-center">
              <Input name="email" type="email" defaultValue={email} />
              {verified ? <Badge tone="positive">verified</Badge> : <Badge tone="warning">unverified</Badge>}
            </div>
          </Field>
          {!verified && (
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => run(() => api("/api/auth/resend-verification", { method: "POST" }), "Verification email sent (check server console in dev).")}
            >
              Resend verification email
            </Button>
          )}
          <Msg msg={msg} />
          <Button disabled={loading}>{loading ? "Saving…" : "Save profile"}</Button>
        </form>
      </CardBody>
    </Card>
  );
}

/* ---------------- Preferences ---------------- */

export function PreferencesForm({ pref }: {
  pref: { currency: string; country: string; timezone: string; distanceUnit: string; theme: string; targetHourlyCents: number | null };
}) {
  const { msg, loading, run } = useSave();
  const applyTheme = (theme: string) => {
    const dark = theme === "DARK" || (theme === "SYSTEM" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("gf-theme", theme.toLowerCase());
  };
  return (
    <Card>
      <CardHeader title="Preferences" subtitle="Units, locale and appearance." />
      <CardBody>
        <form
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const theme = String(fd.get("theme"));
            applyTheme(theme);
            run(() => api("/api/preferences", {
              method: "PATCH",
              body: {
                currency: fd.get("currency"), country: fd.get("country"),
                timezone: fd.get("timezone"), distanceUnit: fd.get("distanceUnit"),
                theme,
                targetHourlyCents: fd.get("hourly") ? Math.round(Number(fd.get("hourly")) * 100) : null,
              },
            }));
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency"><Input name="currency" defaultValue={pref.currency} maxLength={3} className="uppercase" /></Field>
            <Field label="Country"><Input name="country" defaultValue={pref.country} maxLength={2} className="uppercase" /></Field>
          </div>
          <Field label="Timezone"><Input name="timezone" defaultValue={pref.timezone} list="tz-list" />
            <datalist id="tz-list">
              {["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Dubai", "Asia/Kolkata", "Australia/Sydney"].map((t) => <option key={t} value={t} />)}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Distance unit">
              <Select name="distanceUnit" defaultValue={pref.distanceUnit}>
                <option value="MI">Miles</option><option value="KM">Kilometers</option>
              </Select>
            </Field>
            <Field label="Theme">
              <Select name="theme" defaultValue={pref.theme}>
                <option value="SYSTEM">System</option><option value="LIGHT">Light</option><option value="DARK">Dark</option>
              </Select>
            </Field>
          </div>
          <Field label={`Target earnings per hour (${pref.currency})`}>
            <Input name="hourly" inputMode="decimal" defaultValue={pref.targetHourlyCents ? (pref.targetHourlyCents / 100).toFixed(2) : ""} />
          </Field>
          <Msg msg={msg} />
          <Button disabled={loading}>{loading ? "Saving…" : "Save preferences"}</Button>
        </form>
      </CardBody>
    </Card>
  );
}

/* ---------------- Vehicles ---------------- */

type Vehicle = {
  id: string; nickname: string; make: string | null; model: string | null;
  year: number | null; fuelType: string | null; fuelEconomy: number | null;
  financing: string | null; isDefault: boolean; monthlyCostCents: number | null;
};

export function VehiclesPanel({ vehicles }: { vehicles: Vehicle[] }) {
  const { msg, run } = useSave();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Vehicle | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      nickname: fd.get("nickname"), make: fd.get("make") || null, model: fd.get("model") || null,
      year: fd.get("year") ? Number(fd.get("year")) : null,
      fuelType: fd.get("fuelType") || null, fuelEconomy: fd.get("fuelEconomy") ? Number(fd.get("fuelEconomy")) : null,
      financing: fd.get("financing") || null,
      monthlyCostCents: fd.get("monthlyCost") ? Math.round(Number(fd.get("monthlyCost")) * 100) : null,
      isDefault: fd.get("isDefault") === "on",
    };
    await run(() => edit
      ? api(`/api/vehicles/${edit.id}`, { method: "PATCH", body })
      : api("/api/vehicles", { method: "POST", body }),
    );
    setOpen(false); setEdit(null);
  };

  return (
    <Card>
      <CardHeader title="Vehicles" subtitle="Vehicles used for work."
        action={<Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}><Plus size={14} /> Add</Button>} />
      <CardBody>
        {vehicles.length === 0 ? (
          <p className="text-sm text-muted">No vehicles yet.</p>
        ) : (
          <ul className="divide-y divide-border -mx-4 sm:-mx-5">
            {vehicles.map((v) => (
              <li key={v.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2">
                    {v.nickname} {v.isDefault && <Badge tone="accent">default</Badge>}
                  </p>
                  <p className="text-xs text-muted">
                    {[v.year, v.make, v.model].filter(Boolean).join(" ") || "No details"}
                    {v.fuelType ? ` · ${v.fuelType.toLowerCase()}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { setEdit(v); setOpen(true); }}>Edit</Button>
                <button
                  aria-label={`Delete ${v.nickname}`}
                  onClick={() => run(async () => {
                    if (confirm(`Delete ${v.nickname}?`)) await api(`/api/vehicles/${v.id}`, { method: "DELETE" });
                  })}
                  className="text-faint hover:text-negative p-1.5"
                ><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
        <Msg msg={msg} />
      </CardBody>
      <Modal open={open} onClose={() => setOpen(false)} title={edit ? "Edit vehicle" : "Add vehicle"} wide>
        <form onSubmit={submit} key={edit?.id ?? "new"} className="space-y-4">
          <Field label="Nickname"><Input name="nickname" required defaultValue={edit?.nickname} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Make"><Input name="make" defaultValue={edit?.make ?? ""} /></Field>
            <Field label="Model"><Input name="model" defaultValue={edit?.model ?? ""} /></Field>
            <Field label="Year"><Input name="year" inputMode="numeric" defaultValue={edit?.year ?? ""} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Fuel type">
              <Select name="fuelType" defaultValue={edit?.fuelType ?? ""}>
                <option value="">—</option><option value="GAS">Gas</option><option value="DIESEL">Diesel</option>
                <option value="HYBRID">Hybrid</option><option value="EV">EV</option><option value="OTHER">Other</option>
              </Select>
            </Field>
            <Field label="Fuel economy"><Input name="fuelEconomy" inputMode="decimal" defaultValue={edit?.fuelEconomy ?? ""} /></Field>
            <Field label="Ownership">
              <Select name="financing" defaultValue={edit?.financing ?? ""}>
                <option value="">—</option><option value="OWNED">Owned</option><option value="FINANCED">Financed</option>
                <option value="LEASED">Leased</option><option value="RENTAL">Rental</option>
              </Select>
            </Field>
          </div>
          <Field label="Monthly cost (payment/lease, optional)"><Input name="monthlyCost" inputMode="decimal" defaultValue={edit?.monthlyCostCents ? (edit.monthlyCostCents / 100).toFixed(2) : ""} /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isDefault" defaultChecked={edit?.isDefault} className="accent-[var(--accent)]" /> Default vehicle
          </label>
          <Button className="w-full">{edit ? "Save changes" : "Add vehicle"}</Button>
        </form>
      </Modal>
    </Card>
  );
}

/* ---------------- Goals ---------------- */

type Goal = { id: string; name: string; period: string; targetCents: number; active: boolean };

export function GoalsPanel({ goals, currency }: { goals: Goal[]; currency: string }) {
  const { msg, run } = useSave();
  const [open, setOpen] = useState(false);
  const sym = currency;
  return (
    <Card>
      <CardHeader title="Goals" subtitle="Earnings targets tracked on your dashboard."
        action={<Button size="sm" onClick={() => setOpen(true)}><Plus size={14} /> Add</Button>} />
      <CardBody>
        {goals.length === 0 ? <p className="text-sm text-muted">No goals set.</p> : (
          <ul className="divide-y divide-border -mx-4 sm:-mx-5">
            {goals.map((g) => (
              <li key={g.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{g.name || "Goal"}</p>
                  <p className="text-xs text-muted">{g.period.toLowerCase()} · {formatMoney(g.targetCents, sym)}</p>
                </div>
                {!g.active && <Badge>inactive</Badge>}
                <button aria-label="Delete goal" onClick={() => run(async () => { if (confirm("Delete goal?")) await api(`/api/goals/${g.id}`, { method: "DELETE" }); })} className="text-faint hover:text-negative p-1.5"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
        <Msg msg={msg} />
      </CardBody>
      <Modal open={open} onClose={() => setOpen(false)} title="New goal">
        <form
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(async () => {
              await api("/api/goals", {
                method: "POST",
                body: {
                  name: fd.get("name"), period: fd.get("period"),
                  targetCents: Math.round(Number(fd.get("target")) * 100), active: true,
                },
              });
              setOpen(false);
            });
          }}
          className="space-y-4"
        >
          <Field label="Name"><Input name="name" placeholder="Weekly earnings goal" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Period">
              <Select name="period"><option value="DAILY">Daily</option><option value="WEEKLY" selected>Weekly</option><option value="MONTHLY">Monthly</option></Select>
            </Field>
            <Field label={`Target (${sym})`}><Input name="target" inputMode="decimal" required placeholder="1000" /></Field>
          </div>
          <Button className="w-full">Create goal</Button>
        </form>
      </Modal>
    </Card>
  );
}

/* ---------------- Notification prefs ---------------- */

const NOTIF_TYPES = [
  ["MILESTONE", "Earnings milestones"],
  ["GOAL", "Goal progress"],
  ["SYNC_FAILURE", "Sync failures"],
  ["ACCOUNT", "Account events"],
  ["RULE", "Rule events"],
  ["PLATFORM", "Platform issues"],
] as const;

export function NotificationPrefs({ prefs }: { prefs: Record<string, boolean> }) {
  const { msg, run } = useSave();
  const [state, setState] = useState<Record<string, boolean>>(prefs);
  const toggle = (t: string) => {
    const next = { ...state, [t]: !(state[t] ?? true) };
    setState(next);
    void run(() => api("/api/preferences", { method: "PATCH", body: { notificationPrefs: next } }), "Preferences saved.");
  };
  return (
    <Card>
      <CardHeader title="Notifications" subtitle="Choose which events notify you." />
      <CardBody>
        <ul className="divide-y divide-border -mx-4 sm:-mx-5">
          {NOTIF_TYPES.map(([t, label]) => {
            const on = state[t] ?? true;
            return (
              <li key={t} className="px-4 sm:px-5 py-3 flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <button
                  role="switch" aria-checked={on} aria-label={label} onClick={() => toggle(t)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${on ? "bg-accent" : "bg-border-strong"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
                </button>
              </li>
            );
          })}
        </ul>
        <Msg msg={msg} />
      </CardBody>
    </Card>
  );
}

/* ---------------- Security ---------------- */

export function SecurityPanel({ sessions }: {
  sessions: { id: string; ip: string | null; userAgent: string | null; createdAt: string; current: boolean }[];
}) {
  const { msg, run } = useSave();
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Change password" />
        <CardBody>
          <form
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(() => api("/api/account", {
                method: "PATCH",
                body: { currentPassword: fd.get("current"), newPassword: fd.get("next") },
              }), "Password updated. Other sessions were signed out.");
            }}
            className="space-y-4"
          >
            <Field label="Current password"><Input name="current" type="password" required autoComplete="current-password" /></Field>
            <Field label="New password" hint="8+ characters, letters and numbers"><Input name="next" type="password" required minLength={8} autoComplete="new-password" /></Field>
            <Button>Update password</Button>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Active sessions" subtitle="Devices signed in to your account." />
        <CardBody>
          <ul className="divide-y divide-border -mx-4 sm:-mx-5">
            {sessions.map((s) => (
              <li key={s.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                <Monitor size={16} className="text-faint shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{s.userAgent ?? "Unknown device"}</p>
                  <p className="text-[11px] text-faint">{s.ip ?? "—"} · since {formatDateTime(s.createdAt)}</p>
                </div>
                {s.current ? <Badge tone="accent">this device</Badge> : (
                  <Button size="sm" variant="ghost" onClick={() => run(() => api(`/api/sessions/${s.id}`, { method: "DELETE" }), "Session revoked.")}>Revoke</Button>
                )}
              </li>
            ))}
          </ul>
          <Msg msg={msg} />
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------------- Privacy ---------------- */

export function PrivacyPanel({ privacy }: { privacy: Record<string, unknown> }) {
  const { msg, run } = useSave();
  const [state, setState] = useState({
    shareAnonymousUsage: privacy.shareAnonymousUsage === true,
    rememberZones: privacy.rememberZones !== false,
  });
  const save = (patch: Partial<typeof state>) => {
    const next = { ...state, ...patch };
    setState(next);
    void run(() => api("/api/preferences", { method: "PATCH", body: { privacy: next } }), "Saved.");
  };
  return (
    <Card>
      <CardHeader title="Privacy" subtitle="Control what GigFlow stores about you." />
      <CardBody className="space-y-4">
        <p className="text-sm text-muted leading-relaxed">
          GigFlow stores only the data needed to run the product: your account, work
          records, vehicles, preferences and integration state. We do not sell or share
          your data. Location is never tracked continuously — only what you type in.
        </p>
        {[
          ["shareAnonymousUsage", "Share anonymous usage statistics", "Helps improve GigFlow. Never includes earnings or location."],
          ["rememberZones", "Remember zones I've typed", "Autocompletes pickup/dropoff zones from your history."],
        ].map(([key, label, hint]) => (
          <label key={key} className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={state[key as keyof typeof state]}
              onChange={(e) => save({ [key]: e.target.checked })}
              className="mt-0.5 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm">{label}</span>
              <span className="block text-xs text-muted">{hint}</span>
            </span>
          </label>
        ))}
        <Msg msg={msg} />
      </CardBody>
    </Card>
  );
}

/* ---------------- Data ---------------- */

export function DataPanel({ hasDemo }: { hasDemo: boolean }) {
  const { msg, run, router } = useSave();
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Export" subtitle="Download everything GigFlow stores about you." />
        <CardBody>
          <a href="/api/export" download>
            <Button variant="outline">Download JSON export</Button>
          </a>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Demo data" subtitle="Sample records are kept fully separate from real data." />
        <CardBody className="space-y-3">
          <p className="text-sm text-muted">
            {hasDemo
              ? "Demo data is currently enabled. Removing it deletes all sample records — your real entries stay untouched."
              : "Populate your workspace with sample trips, earnings, expenses and offers to explore GigFlow."}
          </p>
          <Button
            variant={hasDemo ? "outline" : "secondary"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await run(() => hasDemo
                ? api("/api/demo", { method: "DELETE" })
                : api("/api/demo", { method: "POST" }),
                hasDemo ? "Demo data removed." : "Demo data created.",
              );
              setBusy(false);
            }}
          >
            {hasDemo ? "Remove demo data" : "Generate demo data"}
          </Button>
        </CardBody>
      </Card>
      <Card className="border-negative/40">
        <CardHeader title="Delete account" subtitle="Permanently removes your account and all data. This cannot be undone." />
        <CardBody>
          <form
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const pw = new FormData(e.currentTarget).get("password");
              if (!confirm("Permanently delete your account and ALL data?")) return;
              run(async () => {
                await api("/api/account", { method: "DELETE", body: { password: pw } });
                router.push("/");
              });
            }}
            className="flex flex-wrap gap-2 items-end"
          >
            <Field label="Confirm with your password" className="flex-1 min-w-48">
              <Input name="password" type="password" required autoComplete="current-password" />
            </Field>
            <Button variant="danger">Delete account</Button>
          </form>
        </CardBody>
      </Card>
      <Msg msg={msg} />
    </div>
  );
}
