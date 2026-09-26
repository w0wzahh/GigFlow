import { requireUser } from "@/lib/auth/session";
import { hasDemoData } from "@/lib/demo";
import { DataPanel } from "@/components/settings-forms";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Data" };

export default async function DataPage() {
  const user = await requireUser();
  return <DataPanel hasDemo={await hasDemoData(user.id)} />;
}
