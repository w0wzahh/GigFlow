import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { VehiclesPanel } from "@/components/settings-forms";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Vehicles" };

export default async function VehiclesPage() {
  const user = await requireUser();
  const vehicles = await db.vehicle.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return <VehiclesPanel vehicles={vehicles} />;
}
