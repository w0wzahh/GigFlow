import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Shell } from "@/components/shell";
import { ensurePlatformCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [pref, unread] = await Promise.all([
    db.userPreference.findUnique({ where: { userId: user.id } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  if (!pref?.onboardingCompletedAt) redirect("/onboarding");
  await ensurePlatformCatalog();

  return (
    <Shell
      userName={user.name}
      userEmail={user.email}
      unreadCount={unread}
    >
      {children}
    </Shell>
  );
}
