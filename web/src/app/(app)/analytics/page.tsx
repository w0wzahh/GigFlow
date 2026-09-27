import { requireUser } from "@/lib/auth/session";
import { getAnalyticsData } from "@/lib/analytics";
import type { RangeKey } from "@/lib/dates";
import { AnalyticsView } from "@/components/analytics-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const user = await requireUser();
  const sp = await searchParams;
  const data = await getAnalyticsData(user.id, {
    rangeKey: (typeof sp.range === "string" ? sp.range : "month") as RangeKey,
    start: typeof sp.start === "string" ? sp.start : undefined,
    end: typeof sp.end === "string" ? sp.end : undefined,
    platformId: typeof sp.platformId === "string" ? sp.platformId : undefined,
    vehicleId: typeof sp.vehicleId === "string" ? sp.vehicleId : undefined,
  });
  return (
    <AnalyticsView
      data={data}
      rangeKey={typeof sp.range === "string" ? sp.range : "month"}
      platformId={typeof sp.platformId === "string" ? sp.platformId : ""}
      vehicleId={typeof sp.vehicleId === "string" ? sp.vehicleId : ""}
    />
  );
}
