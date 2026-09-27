import { ForgotPasswordForm } from "@/components/auth-forms";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
