import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { ScheduleView } from "@/components/schedule-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Schedule" };
export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const user = await requireUser();
  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });
  const [entries, platforms] = await Promise.all([
    db.scheduleEntry.findMany({ where: { userId: user.id }, orderBy: [{ dayOfWeek: "asc" }, { startMin: "asc" }] }),
    db.platformConnection.findMany({
      where: { userId: user.id },
      include: { platform: { select: { id: true, name: true, color: true } } },
    }),
  ]);
  return (
    <ScheduleView
      currency={pref?.currency ?? "USD"}
      platforms={platforms.map((c) => c.platform)}
      entries={entries.map((e) => ({
        id: e.id, title: e.title, dayOfWeek: e.dayOfWeek,
        date: e.date?.toISOString().slice(0, 10) ?? null,
        startMin: e.startMin, endMin: e.endMin, zone: e.zone,
        targetCents: e.targetCents,
        platformIds: (() => { try { return JSON.parse(e.platformIds ?? "[]"); } catch { return []; } })(),
      }))}
    />
  );
}
