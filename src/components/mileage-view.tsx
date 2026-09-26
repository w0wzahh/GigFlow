"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, Stat, Button, Badge, EmptyState } from "@/components/ui/primitives";
import { PageHeader } from "@/components/page-header";
import { RangeTabs } from "@/components/earnings-view";
import { MileageModal } from "@/components/quick-add";
import { formatDate, kmToUnit, unitLabel } from "@/lib/units";
import { api } from "@/lib/client";
import { Plus, Trash2, Gauge } from "lucide-react";

type MileageRow = {
  id: string; date: string; distanceKm: number; purpose: string;
  startLocation: string | null; endLocation: string | null; source: string;
  vehicle: { nickname: string } | null;
};

export function MileageView({
  distanceUnit, rangeKey, records, totals, vehicles,
}: {
  currency: string; distanceUnit: "MI" | "KM"; rangeKey: string;
  records: MileageRow[];
  totals: { purpose: string; km: number }[];
  vehicles: { id: string; nickname: string }[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const work = totals.find((t) => t.purpose === "WORK")?.km ?? 0;
  const personal = totals.find((t) => t.purpose === "PERSONAL")?.km ?? 0;
  const other = totals.find((t) => t.purpose === "OTHER")?.km ?? 0;
  const total = work + personal + other;
  const fmt = (km: number) => `${kmToUnit(km, distanceUnit).toFixed(1)} ${unitLabel(distanceUnit)}`;

  const remove = async (id: string) => {
    if (!confirm("Delete this record?")) return;
    await api(`/api/mileage/${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mileage"
        subtitle="Work and personal distance tracking."
        actions={
          <>
            <RangeTabs rangeKey={rangeKey} base="/mileage" />
            <Button size="sm" onClick={() => setModalOpen(true)}><Plus size={14} /> Log mileage</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardBody><Stat label="Total" value={fmt(total)} /></CardBody></Card>
        <Card><CardBody><Stat label="Work" value={fmt(work)} /></CardBody></Card>
        <Card><CardBody><Stat label="Personal" value={fmt(personal)} /></CardBody></Card>
        <Card><CardBody><Stat label="Work share" value={total > 0 ? `${((work / total) * 100).toFixed(0)}%` : "—"} sub="of tracked distance" /></CardBody></Card>
      </div>

      <Card>
        <CardHeader title="Records" subtitle={`${records.length} shown`} />
        <CardBody>
          {records.length === 0 ? (
            <EmptyState icon={<Gauge size={26} />} title="No mileage logged" body="Log daily distance to separate work and personal miles." action={<Button size="sm" onClick={() => setModalOpen(true)}><Plus size={14} /> Log mileage</Button>} />
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-5">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-xs text-faint border-b border-border">
                    <th className="px-4 sm:px-5 py-2 font-medium">Date</th>
                    <th className="py-2 font-medium">Purpose</th>
                    <th className="py-2 font-medium">Vehicle</th>
                    <th className="py-2 font-medium">Route</th>
                    <th className="py-2 font-medium text-right">Distance</th>
                    <th className="py-2 font-medium w-8"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.map((r) => (
                    <tr key={r.id} className="group">
                      <td className="px-4 sm:px-5 py-2.5 whitespace-nowrap text-muted">{formatDate(r.date)}
                        {r.source === "DEMO" && <Badge tone="accent" className="ml-1.5">demo</Badge>}
                      </td>
                      <td className="py-2.5"><Badge tone={r.purpose === "WORK" ? "accent" : "neutral"}>{r.purpose.toLowerCase()}</Badge></td>
                      <td className="py-2.5 text-muted">{r.vehicle?.nickname ?? "—"}</td>
                      <td className="py-2.5 text-muted max-w-48 truncate">
                        {r.startLocation || r.endLocation ? `${r.startLocation ?? "?"} → ${r.endLocation ?? "?"}` : "—"}
                      </td>
                      <td className="py-2.5 text-right tabular-nums font-medium">{fmt(r.distanceKm)}</td>
                      <td className="py-2.5 text-right">
                        <button onClick={() => remove(r.id)} aria-label="Delete" className="text-faint hover:text-negative opacity-0 group-hover:opacity-100 focus:opacity-100 p-1"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <MileageModal open={modalOpen} onClose={() => setModalOpen(false)} vehicles={vehicles} distanceUnit={distanceUnit} />
    </div>
  );
}
