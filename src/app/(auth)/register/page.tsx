import { RegisterForm } from "@/components/auth-forms";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return <RegisterForm />;
}
