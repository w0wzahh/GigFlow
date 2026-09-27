import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { PrivacyPanel } from "@/components/settings-forms";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  const user = await requireUser();
  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });
  let privacy: Record<string, unknown> = {};
  try { privacy = JSON.parse(pref?.privacyJson ?? "{}"); } catch { /* default */ }
  return <PrivacyPanel privacy={privacy} />;
}
