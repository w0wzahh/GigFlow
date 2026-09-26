"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, Stat, Button, Badge, EmptyState } from "@/components/ui/primitives";
import { PageHeader } from "@/components/page-header";
import { RangeTabs } from "@/components/earnings-view";
import { ExpenseModal } from "@/components/quick-add";
import { formatMoney, formatDate } from "@/lib/units";
import { api } from "@/lib/client";
import { Plus, Pencil, Trash2, Receipt } from "lucide-react";

type ExpenseRow = {
  id: string; category: string; amountCents: number; occurredAt: string;
  description: string | null; vehicleId: string | null; source: string;
  vehicle: { nickname: string } | null;
};

export function ExpensesView({
  currency, rangeKey, expenses, byCategory, vehicles,
}: {
  currency: string; rangeKey: string;
  expenses: ExpenseRow[];
  byCategory: { category: string; amountCents: number }[];
  vehicles: { id: string; nickname: string }[];
}) {
  const router = useRouter();
  const money = (c: number) => formatMoney(c, currency);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const total = byCategory.reduce((s, c) => s + c.amountCents, 0);
  const max = byCategory[0]?.amountCents ?? 1;

  const remove = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    await api(`/api/expenses/${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Expenses"
        subtitle="Vehicle and work-related costs."
        actions={
          <>
            <RangeTabs rangeKey={rangeKey} base="/expenses" />
            <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={14} /> Add expense</Button>
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <Card><CardBody><Stat label="Total expenses" value={money(total)} sub={`${expenses.length} entries`} /></CardBody></Card>
        <Card className="lg:col-span-2">
          <CardHeader title="By category" />
          <CardBody>
            {byCategory.length === 0 ? <EmptyState title="No expenses in range" /> : (
              <ul className="space-y-2.5">
                {byCategory.map((c) => (
                  <li key={c.category} className="flex items-center gap-3">
                    <span className="text-xs text-muted w-28 truncate">{c.category.replace(/_/g, " ").toLowerCase()}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-subtle overflow-hidden">
                      <div className="h-full bg-negative/70 rounded-full" style={{ width: `${(c.amountCents / max) * 100}%` }} />
                    </div>
                    <span className="text-xs font-medium tabular-nums w-20 text-right">{money(c.amountCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Entries" subtitle={`${expenses.length} shown`} />
        <CardBody>
          {expenses.length === 0 ? (
            <EmptyState icon={<Receipt size={26} />} title="No expenses yet" body="Track fuel, maintenance, insurance and more." action={<Button size="sm" onClick={() => setModalOpen(true)}><Plus size={14} /> Add expense</Button>} />
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-5">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-xs text-faint border-b border-border">
                    <th className="px-4 sm:px-5 py-2 font-medium">Date</th>
                    <th className="py-2 font-medium">Category</th>
                    <th className="py-2 font-medium">Description</th>
                    <th className="py-2 font-medium">Vehicle</th>
                    <th className="py-2 font-medium text-right">Amount</th>
                    <th className="py-2 font-medium w-16"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {expenses.map((e) => (
                    <tr key={e.id} className="group">
                      <td className="px-4 sm:px-5 py-2.5 whitespace-nowrap text-muted">{formatDate(e.occurredAt)}
                        {e.source === "DEMO" && <Badge tone="accent" className="ml-1.5">demo</Badge>}
                      </td>
                      <td className="py-2.5"><Badge>{e.category.replace(/_/g, " ").toLowerCase()}</Badge></td>
                      <td className="py-2.5 text-muted max-w-48 truncate">{e.description ?? "—"}</td>
                      <td className="py-2.5 text-muted">{e.vehicle?.nickname ?? "—"}</td>
                      <td className="py-2.5 text-right tabular-nums font-medium text-negative">{money(e.amountCents)}</td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => { setEditing(e); setModalOpen(true); }} aria-label="Edit" className="text-faint hover:text-fg opacity-0 group-hover:opacity-100 focus:opacity-100 p-1"><Pencil size={14} /></button>
                        <button onClick={() => remove(e.id)} aria-label="Delete" className="text-faint hover:text-negative opacity-0 group-hover:opacity-100 focus:opacity-100 p-1"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <ExpenseModal open={modalOpen} onClose={() => setModalOpen(false)} vehicles={vehicles} edit={editing} />
    </div>
  );
}
