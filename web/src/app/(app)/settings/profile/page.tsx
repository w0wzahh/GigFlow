import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { ProfileForm } from "@/components/settings-forms";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const dbUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  return (
    <ProfileForm name={dbUser.name} email={dbUser.email} verified={!!dbUser.emailVerifiedAt} />
  );
}
