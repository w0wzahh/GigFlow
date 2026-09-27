import { requireUser } from "@/lib/auth/session";
import { DataPanel } from "@/components/settings-forms";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Data" };

export default async function DataPage() {
  await requireUser();
  return <DataPanel />;
}
