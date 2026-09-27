import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { consumeToken } from "@/lib/auth/tokens";
import { withErrors, parseBody, errors, ok, assertSameOrigin } from "@/lib/api";
import { z } from "zod";
import { passwordSchema } from "@/lib/schemas";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const schema = z.object({
  token: z.string().min(10),
  password: passwordSchema,
});

export const POST = withErrors(async (req) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  const rl = rateLimit(`reset:${ip}`, 10, 60_000);
  if (!rl.ok) throw errors.tooMany(rl.retryAfterSec);

  const { token, password } = await parseBody(req, schema);
  const userId = await consumeToken(token, "PASSWORD_RESET");
  if (!userId) throw errors.badRequest("This reset link is invalid or has expired.");

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(password) },
    }),
    // Invalidate all existing sessions on password change.
    db.session.deleteMany({ where: { userId } }),
  ]);
  return ok({ reset: true });
});
