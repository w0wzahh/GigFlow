import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getDashboardData } from "@/lib/dashboard";
import { DashboardView } from "@/components/dashboard-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const data = await getDashboardData(user.id);
  return <DashboardView data={data} />;
}
