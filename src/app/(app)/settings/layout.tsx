import { requireUser } from "@/lib/auth/session";
import { SettingsNav } from "@/components/settings-nav";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Account, workspace and data controls.</p>
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        <SettingsNav />
        <div className="flex-1 min-w-0 max-w-2xl">{children}</div>
      </div>
    </div>
  );
}
