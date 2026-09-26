import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { PreferencesForm } from "@/components/settings-forms";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Preferences" };

export default async function PreferencesPage() {
  const user = await requireUser();
  const pref = await db.userPreference.upsert({
    where: { userId: user.id }, update: {}, create: { userId: user.id },
  });
  return <PreferencesForm pref={pref} />;
}
