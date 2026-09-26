import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { parseRuleRow } from "@/lib/rules/engine";
import { RulesView } from "@/components/rules-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Smart Rules" };
export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const user = await requireUser();
  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });
  const [rules, platforms] = await Promise.all([
    db.rule.findMany({ where: { userId: user.id }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] }),
    db.platform.findMany({ select: { id: true, name: true } }),
  ]);
  return (
    <RulesView
      currency={pref?.currency ?? "USD"}
      distanceUnit={(pref?.distanceUnit ?? "MI") as "MI" | "KM"}
      platforms={platforms}
      rules={rules.map(parseRuleRow)}
    />
  );
}
