import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifyOAuthState, exchangeCode, emailFromIdToken, encryptTokens,
} from "@/lib/integrations/gmail";

const base = () => process.env.APP_URL ?? "http://localhost:3000";

/** Google redirects here after consent. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const verified = verifyOAuthState(state);
  if (!verified || !code) {
    return NextResponse.redirect(new URL("/platforms?gmail=error", base()));
  }

  try {
    const tokens = await exchangeCode(code);
    const email = emailFromIdToken(tokens.id_token) ?? "gmail-account";
    const enc = encryptTokens(tokens);

    await db.account.upsert({
      where: { provider_providerAccountId: { provider: "gmail", providerAccountId: email } },
      update: { userId: verified.userId, ...enc },
      create: {
        userId: verified.userId,
        provider: "gmail",
        providerAccountId: email,
        scope: "gmail.readonly",
        ...enc,
      },
    });
    return NextResponse.redirect(new URL("/platforms?gmail=connected", base()));
  } catch {
    return NextResponse.redirect(new URL("/platforms?gmail=error", base()));
  }
}
