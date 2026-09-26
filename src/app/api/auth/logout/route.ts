import { cookies } from "next/headers";
import { destroySession, SESSION_COOKIE, clearSessionCookie } from "@/lib/auth/session";
import { withErrors, ok, assertSameOrigin } from "@/lib/api";

export const POST = withErrors(async (req) => {
  assertSameOrigin(req);
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  await clearSessionCookie();
  return ok({ loggedOut: true });
});
