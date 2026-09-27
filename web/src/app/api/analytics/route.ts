import { withAuth, ok } from "@/lib/api";
import { getAnalyticsData } from "@/lib/analytics";
import type { RangeKey } from "@/lib/dates";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  return ok(
    await getAnalyticsData(user.id, {
      rangeKey: (url.searchParams.get("range") as RangeKey) ?? "month",
      start: url.searchParams.get("start") ?? undefined,
      end: url.searchParams.get("end") ?? undefined,
      platformId: url.searchParams.get("platformId") ?? undefined,
      vehicleId: url.searchParams.get("vehicleId") ?? undefined,
    }),
  );
});
