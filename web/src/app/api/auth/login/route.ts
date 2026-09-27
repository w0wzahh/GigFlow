import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { withErrors, parseBody, errors, ok, assertSameOrigin } from "@/lib/api";
import { loginSchema } from "@/lib/schemas";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const POST = withErrors(async (req) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  const rl = rateLimit(`login:${ip}`, 10, 60_000);
  if (!rl.ok) throw errors.tooMany(rl.retryAfterSec);

  const body = await parseBody(req, loginSchema);
  const user = await db.user.findUnique({ where: { email: body.email } });

  // Uniform failure message — don't reveal whether the email exists.
  if (!user || user.deletedAt || !(await verifyPassword(body.password, user.passwordHash))) {
    throw errors.badRequest("Invalid email or password.");
  }

  const token = await createSession(user.id, {
    ip,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  await setSessionCookie(token);
  return ok({ id: user.id, email: user.email });
});
