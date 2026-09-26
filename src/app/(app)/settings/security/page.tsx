import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { SecurityPanel } from "@/components/settings-forms";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  const user = await requireUser();
  const sessions = await db.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <SecurityPanel
      sessions={sessions.map((s) => ({
        id: s.id, ip: s.ip, userAgent: s.userAgent,
        createdAt: s.createdAt.toISOString(), current: s.id === user.sessionId,
      }))}
    />
  );
}
