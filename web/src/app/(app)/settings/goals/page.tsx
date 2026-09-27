import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { GoalsPanel } from "@/components/settings-forms";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage() {
  const user = await requireUser();
  const [goals, pref] = await Promise.all([
    db.goal.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    db.userPreference.findUnique({ where: { userId: user.id } }),
  ]);
  return <GoalsPanel goals={goals} currency={pref?.currency ?? "USD"} />;
}
