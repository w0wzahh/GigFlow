import { db } from "@/lib/db";
import { withAuth, parseBody, ok, assertSameOrigin } from "@/lib/api";
import { preferencesSchema } from "@/lib/schemas";

export const GET = withAuth(async (_req, { user }) => {
  const pref = await db.userPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
  return ok({
    ...pref,
    notificationPrefs: safeParse(pref.notificationPrefsJson),
    privacy: safeParse(pref.privacyJson),
  });
});

export const PATCH = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const body = await parseBody(req, preferencesSchema);
  const data: Record<string, unknown> = {};
  for (const k of ["currency", "country", "timezone", "distanceUnit", "theme", "targetHourlyCents", "weeklyGoalCents"] as const) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  if (body.notificationPrefs !== undefined) data.notificationPrefsJson = JSON.stringify(body.notificationPrefs);
  if (body.privacy !== undefined) data.privacyJson = JSON.stringify(body.privacy);
  const pref = await db.userPreference.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });
  return ok(pref);
});

function safeParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}
