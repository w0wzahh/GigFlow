import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { NotificationsView } from "@/components/notifications-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <NotificationsView
      items={items.map((n) => ({
        id: n.id, type: n.type, title: n.title, body: n.body,
        read: !!n.readAt, createdAt: n.createdAt.toISOString(),
      }))}
    />
  );
}
