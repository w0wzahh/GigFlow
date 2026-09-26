import { withAuth, ok, assertSameOrigin } from "@/lib/api";
import { generateDemoData, clearDemoData, hasDemoData } from "@/lib/demo";
import { rateLimit } from "@/lib/ratelimit";
import { errors } from "@/lib/api";

export const POST = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const rl = rateLimit(`demo:${user.id}`, 5, 60_000);
  if (!rl.ok) throw errors.tooMany(rl.retryAfterSec);
  const result = await generateDemoData(user.id);
  return ok(result);
});

export const DELETE = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  await clearDemoData(user.id);
  return ok({ cleared: true });
});

export const GET = withAuth(async (_req, { user }) => {
  return ok({ enabled: await hasDemoData(user.id) });
});
