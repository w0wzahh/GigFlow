import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ensurePlatformCatalog } from "@/lib/catalog";
import { OnboardingWizard } from "@/components/onboarding";
import { Logo } from "@/components/ui/logo";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Set up your workspace" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/onboarding");
  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });
  if (pref?.onboardingCompletedAt) redirect("/dashboard");

  await ensurePlatformCatalog();
  const platforms = await db.platform.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="h-14 border-b border-border px-4 sm:px-6 flex items-center justify-between">
        <Logo />
        <span className="text-xs text-muted">Step-by-step setup</span>
      </header>
      <main className="flex-1 flex items-start sm:items-center justify-center p-4 py-8">
        <OnboardingWizard
          userName={user.name}
          platforms={platforms.map((p) => ({
            id: p.id, key: p.key, name: p.name, color: p.color,
            status: p.status, statusNote: p.statusNote,
          }))}
          defaultTimezone={Intl.DateTimeFormat().resolvedOptions().timeZone}
        />
      </main>
    </div>
  );
}
