"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, Button, Badge, EmptyState } from "@/components/ui/primitives";
import { PageHeader } from "@/components/page-header";
import { PlatformDot } from "@/components/platform-dot";
import { Modal } from "@/components/ui/modal";
import { formatMoney, formatDateTime } from "@/lib/units";
import { api, ApiClientError } from "@/lib/client";
import { RefreshCw, Link2, Unlink, Info, Upload, Mail, FileUp, CheckCircle2, AlertCircle } from "lucide-react";

type PlatformRow = {
  id: string; key: string; name: string; category: string;
  status: string; statusNote: string | null; color: string;
  connection: { id: string; status: string; lastSyncAt: string | null; lastError: string | null } | null;
  totalGrossCents: number;
};

type SourceStatus = {
  key: string;
  label: string;
  description: string;
  status: "AVAILABLE" | "CONNECTED" | "NEEDS_SETUP";
  email?: string | null;
  configured?: boolean;
  connected?: boolean;
};

function statusBadge(status: string) {
  if (status === "IMPORT") return <Badge tone="accent">Statement import</Badge>;
  if (status === "COMING_SOON") return <Badge tone="neutral">Coming soon</Badge>;
  return <Badge tone="neutral">Manual tracking</Badge>;
}

function connBadge(status: string) {
  if (status === "CONNECTED") return <Badge tone="positive">Connected</Badge>;
  if (status === "ERROR") return <Badge tone="negative">Error</Badge>;
  if (status === "PENDING") return <Badge tone="neutral">Pending</Badge>;
  return <Badge tone="neutral">Manual</Badge>;
}

export function PlatformsView({ platforms, currency }: { platforms: PlatformRow[]; currency: string }) {
  const router = useRouter();
  const money = (c: number) => formatMoney(c, currency);
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState<PlatformRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [importModal, setImportModal] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; duplicates: number; skippedRows: number } | null>(null);

  useEffect(() => {
    api<{ sources: SourceStatus[] }>("/api/integrations").then((r) => setSources(r.sources)).catch(() => {});
  }, []);

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
  const gmail = sources.find((s) => s.key === "gmail");

  return (
    <div className="space-y-5">
      <PageHeader title="Platforms" subtitle="Manage the platforms you work on and how your data gets in." />

      {error && <p className="text-sm text-negative" role="alert">{error}</p>}

      {/* Real data sources */}
      <Card>
        <CardHeader title="Data sources" subtitle="Real ways to get your earnings into GigFlow — no fake connections." />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-lg bg-accent-soft text-accent inline-flex items-center justify-center shrink-0"><FileUp size={17} /></span>
              <div className="min-w-0">
                <p className="text-sm font-medium">Statement import</p>
                <p className="text-xs text-muted">Upload the CSV earnings export from any platform&apos;s driver portal.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setImportResult(null); setImportModal(true); }}>
              <Upload size={13} /> Import CSV
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-lg bg-accent-soft text-accent inline-flex items-center justify-center shrink-0"><Mail size={17} /></span>
              <div className="min-w-0">
                <p className="text-sm font-medium flex items-center gap-2">
                  Gmail receipts
                  {gmail?.connected && <Badge tone="positive">Connected</Badge>}
                  {gmail?.status === "NEEDS_SETUP" && <Badge tone="neutral">Needs setup</Badge>}
                </p>
                <p className="text-xs text-muted">
                  {gmail?.connected && gmail.email
                    ? `Reading trip receipts for ${gmail.email}.`
                    : "Turn Uber and Lyft trip-receipt emails into earnings. Read-only access, revocable anytime."}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {gmail?.connected ? (
                <Button
                  size="sm" variant="outline" disabled={busy === "gmail:sync"}
                  onClick={() => act("gmail:sync", () => api("/api/integrations/gmail", { method: "POST" }))}
                >
                  <RefreshCw size={13} className={busy === "gmail:sync" ? "animate-spin" : ""} /> Sync now
                </Button>
              ) : gmail?.configured ? (
                <a href="/api/integrations/gmail/authorize"><Button size="sm" variant="outline"><Link2 size={13} /> Connect Gmail</Button></a>
              ) : (
                <span className="text-[11px] text-faint self-center">Requires GOOGLE_CLIENT_ID/SECRET — see docs/integrations.md</span>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {connected.length > 0 && (
        <section aria-label="Your platforms">
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
                        {connBadge(p.connection!.status)}
                      </div>
                      <p className="text-xs text-muted mt-0.5">
                        Lifetime tracked: {money(p.totalGrossCents)}
                      </p>
                      <p className="text-[11px] text-faint mt-0.5">
                        {p.connection!.lastSyncAt
                          ? `Last sync ${formatDateTime(p.connection!.lastSyncAt)}`
                          : p.status === "IMPORT" ? "Import statements or log manually" : "Manual tracking"}
                      </p>
                      {p.connection!.lastError && (
                        <p className="text-[11px] text-negative mt-0.5">{p.connection!.lastError}</p>
                      )}
                    </div>
                    <button onClick={() => setInfo(p)} aria-label={`About ${p.name}`} className="text-faint hover:text-fg p-1"><Info size={15} /></button>
                  </div>
                  <div className="flex gap-2 mt-4">
                    {p.status === "IMPORT" && (
                      <Button size="sm" variant="outline" onClick={() => { setImportResult(null); setImportModal(true); }}>
                        <Upload size={13} /> Import statement
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
                      {statusBadge(p.status)}
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
                      <Link2 size={13} /> {busy === p.id ? "Adding…" : p.status === "IMPORT" ? "Add — then import" : "Track manually"}
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
        {available.length === 0 && <EmptyState title="All platforms added" />}
      </section>

      <ImportModal
        open={importModal}
        onClose={() => setImportModal(false)}
        platforms={platforms.filter((p) => p.status === "IMPORT" || p.key === "other")}
        result={importResult}
        setResult={setImportResult}
        onDone={() => { setImportModal(false); router.refresh(); }}
      />

      <Modal open={!!info} onClose={() => setInfo(null)} title={info?.name ?? ""}>
        {info && (
          <div className="space-y-3 text-sm">
            <p className="text-muted">{info.statusNote}</p>
            <p className="text-muted">
              GigFlow does not pretend to integrate where no official API exists.
              {info.status === "IMPORT"
                ? ` Export your earnings statement from ${info.name}'s driver portal and import it — or log work manually.`
                : ` You can still assign earnings, trips and expenses to ${info.name} manually so your analytics stay complete.`}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ImportModal({
  open, onClose, platforms, result, setResult, onDone,
}: {
  open: boolean;
  onClose: () => void;
  platforms: PlatformRow[];
  result: { imported: number; duplicates: number; skippedRows: number } | null;
  setResult: (r: { imported: number; duplicates: number; skippedRows: number }) => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [platformId, setPlatformId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async () => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (platformId) form.append("platformId", platformId);
      const res = await fetch("/api/import", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Import failed.");
      setResult(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Import an earnings statement">
      {result ? (
        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-2 text-positive">
            <CheckCircle2 size={18} />
            <p className="font-medium">Import complete</p>
          </div>
          <ul className="space-y-1.5 text-muted">
            <li>{result.imported} earnings imported</li>
            {result.duplicates > 0 && <li>{result.duplicates} rows skipped — already imported</li>}
            {result.skippedRows > 0 && <li>{result.skippedRows} rows skipped — missing date or amount</li>}
          </ul>
          <Button onClick={onDone} className="w-full">Done</Button>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <p className="text-muted">
            Export your earnings or payment statement as CSV from your platform&apos;s
            driver dashboard, then upload it here. Columns are detected
            automatically; re-importing the same file never creates duplicates.
          </p>
          <div>
            <label htmlFor="import-platform" className="text-xs font-medium text-muted block mb-1.5">Platform</label>
            <select
              id="import-platform"
              value={platformId}
              onChange={(e) => setPlatformId(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            >
              <option value="">Other / not listed</option>
              {platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-lg border border-dashed border-border-strong p-6 text-center hover:border-accent hover:bg-accent-soft/30 transition-colors"
          >
            <Upload size={20} className="mx-auto text-muted" />
            <p className="mt-2 text-sm font-medium">{file ? file.name : "Choose a CSV file"}</p>
            <p className="text-xs text-faint mt-1">{file ? `${(file.size / 1024).toFixed(0)} KB` : "Up to 4 MB"}</p>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {error && (
            <p className="text-sm text-negative flex items-center gap-1.5" role="alert">
              <AlertCircle size={14} /> {error}
            </p>
          )}
          <Button onClick={upload} disabled={!file || busy} className="w-full">
            {busy ? "Importing…" : "Import"}
          </Button>
        </div>
      )}
    </Modal>
  );
}
