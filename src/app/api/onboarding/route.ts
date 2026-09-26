import { db } from "@/lib/db";
import { withAuth, parseBody, ok, assertSameOrigin } from "@/lib/api";
import { onboardingSchema } from "@/lib/schemas";
import { ensurePlatformCatalog } from "@/lib/catalog";
import { generateDemoData } from "@/lib/demo";

export const POST = withAuth(async (req, { user }) => {
  assertSameOrigin(req);
  const body = await parseBody(req, onboardingSchema);
  await ensurePlatformCatalog();

  await db.$transaction(async (tx) => {
    if (body.name !== undefined) {
      await tx.user.update({ where: { id: user.id }, data: { name: body.name } });
    }
    await tx.userPreference.upsert({
      where: { userId: user.id },
      update: {
        currency: body.currency,
        country: body.country,
        timezone: body.timezone,
        distanceUnit: body.distanceUnit,
        targetHourlyCents: body.targetHourlyCents ?? null,
        weeklyGoalCents: body.weeklyGoalCents ?? null,
        onboardingCompletedAt: new Date(),
      },
      create: {
        userId: user.id,
        currency: body.currency,
        country: body.country,
        timezone: body.timezone,
        distanceUnit: body.distanceUnit,
        targetHourlyCents: body.targetHourlyCents ?? null,
        weeklyGoalCents: body.weeklyGoalCents ?? null,
        onboardingCompletedAt: new Date(),
      },
    });

    // Connect selected platforms (only ones that are actually connectable).
    if (body.platformKeys.length) {
      const platforms = await tx.platform.findMany({
        where: { key: { in: body.platformKeys } },
      });
      for (const p of platforms) {
        await tx.platformConnection.upsert({
          where: { userId_platformId: { userId: user.id, platformId: p.id } },
          update: {},
          create: {
            userId: user.id,
            platformId: p.id,
            // Adapter-backed platforms get a live/demo connection; everything
            // else is tracked manually — never pretend otherwise.
            status: p.adapterKey ? "MOCK" : "MANUAL",
          },
        });
      }
    }

    if (body.vehicle) {
      await tx.vehicle.create({
        data: { ...body.vehicle, userId: user.id, isDefault: true },
      });
    }

    if (body.weeklyGoalCents) {
      await tx.goal.create({
        data: {
          userId: user.id,
          name: "Weekly earnings goal",
          period: "WEEKLY",
          targetCents: body.weeklyGoalCents,
        },
      });
    }
  });

  if (body.enableDemo) {
    await generateDemoData(user.id);
  }

  return ok({ complete: true });
});
