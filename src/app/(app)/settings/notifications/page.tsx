import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { NotificationPrefs } from "@/components/settings-forms";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationSettingsPage() {
  const user = await requireUser();
  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });
  let prefs: Record<string, boolean> = {};
  try { prefs = JSON.parse(pref?.notificationPrefsJson ?? "{}"); } catch { /* default */ }
  return <NotificationPrefs prefs={prefs} />;
}
