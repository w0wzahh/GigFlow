"use client";

import { useRouter } from "next/navigation";
import { Card, CardBody, Button, Badge, EmptyState } from "@/components/ui/primitives";
import { PageHeader } from "@/components/page-header";
import { formatDateTime } from "@/lib/units";
import { api } from "@/lib/client";
import { Bell, CheckCheck } from "lucide-react";

type Item = { id: string; type: string; title: string; body: string | null; read: boolean; createdAt: string };

const TYPE_TONE: Record<string, "accent" | "positive" | "negative" | "warning" | "neutral"> = {
  MILESTONE: "positive", GOAL: "accent", SYNC_FAILURE: "negative",
  ACCOUNT: "neutral", RULE: "accent", PLATFORM: "warning", SYSTEM: "neutral",
};

export function NotificationsView({ items }: { items: Item[] }) {
  const router = useRouter();
  const unread = items.filter((i) => !i.read);

  const markAll = async () => {
    await api("/api/notifications/read", { method: "POST", body: {} });
    router.refresh();
  };
  const markOne = async (id: string) => {
    await api("/api/notifications/read", { method: "POST", body: { ids: [id] } });
    router.refresh();
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader
        title="Notifications"
        subtitle={unread.length ? `${unread.length} unread` : "You're caught up."}
        actions={unread.length ? <Button size="sm" variant="outline" onClick={markAll}><CheckCheck size={14} /> Mark all read</Button> : undefined}
      />
      {items.length === 0 ? (
        <Card><CardBody>
          <EmptyState icon={<Bell size={26} />} title="No notifications" body="Milestones, goal progress and sync events will appear here." />
        </CardBody></Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => !n.read && markOne(n.id)}
                    className="w-full text-left px-4 sm:px-5 py-3.5 flex items-start gap-3 hover:bg-subtle/50"
                  >
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? "bg-border" : "bg-accent"}`} aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm truncate ${n.read ? "text-muted" : "font-medium"}`}>{n.title}</p>
                        <Badge tone={TYPE_TONE[n.type] ?? "neutral"}>{n.type.toLowerCase().replace(/_/g, " ")}</Badge>
                      </div>
                      {n.body && <p className="text-xs text-muted mt-0.5">{n.body}</p>}
                      <p className="text-[11px] text-faint mt-1">{formatDateTime(n.createdAt)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
