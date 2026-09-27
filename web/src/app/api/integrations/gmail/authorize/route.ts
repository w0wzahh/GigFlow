import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { authorizeUrl, gmailConfigured } from "@/lib/integrations/gmail";

/** Browser entry point: /api/integrations/gmail/authorize → Google consent. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.APP_URL ?? "http://localhost:3000"));
  if (!gmailConfigured()) {
    return NextResponse.redirect(new URL("/platforms?gmail=not_configured", process.env.APP_URL ?? "http://localhost:3000"));
  }
  return NextResponse.redirect(authorizeUrl(user.id));
}
