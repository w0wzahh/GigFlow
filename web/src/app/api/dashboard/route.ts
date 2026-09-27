import { withAuth, ok } from "@/lib/api";
import { getDashboardData } from "@/lib/dashboard";

export const GET = withAuth(async (_req, { user }) => {
  return ok(await getDashboardData(user.id));
});
